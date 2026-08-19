//! Décodage du format CryXmlB, le XML binaire de CryEngine.
//!
//! Star Citizen stocke ses fichiers de configuration sous cette forme dans
//! `Data.p4k`. La structure est celle qu'emploie `extract_socpak.py` : un
//! en-tête, quatre tables — nœuds, attributs, enfants, chaînes — et des
//! décalages dans la table de chaînes.
//!
//! On produit du **texte XML** plutôt qu'un arbre typé, afin de réutiliser le
//! parseur d'`actionmaps.xml` déjà écrit et éprouvé. Un profil par défaut a
//! exactement la même structure qu'un profil utilisateur : le décoder vers un
//! second modèle serait du travail en double, et deux modèles finiraient par
//! diverger.

use crate::{Error, Result};

const SIGNATURE: &[u8] = b"CryXmlB";
/// Signature (8 octets) puis neuf entiers 32 bits.
const HEADER_LEN: usize = 8 + 9 * 4;
/// Décalage nom, décalage contenu, nb attributs, nb enfants, parent,
/// premier attribut, premier enfant, réservé.
const NODE_LEN: usize = 28;
/// Décalage de la clé, décalage de la valeur.
const ATTR_LEN: usize = 8;

/// Le tampon est-il du CryXmlB ?
///
/// Tous les `.xml` de l'archive ne le sont pas : certains sont du texte brut.
pub fn is_cryxml(data: &[u8]) -> bool {
    data.starts_with(SIGNATURE)
}

/// Un nœud décodé, avec sa descendance reconstruite.
struct Node {
    name: String,
    content: String,
    first_attr: usize,
    attr_count: usize,
    parent: i32,
    children: Vec<usize>,
}

/// Décode un tampon CryXmlB en texte XML.
///
/// Renvoie le contenu tel quel s'il s'agit déjà de texte : l'appelant n'a pas
/// à savoir sous quelle forme le jeu a stocké tel fichier.
pub fn to_xml(data: &[u8]) -> Result<String> {
    if !is_cryxml(data) {
        return String::from_utf8(data.to_vec())
            .map_err(|e| Error::Schema(format!("contenu illisible: {e}")));
    }

    if data.len() < HEADER_LEN {
        return Err(Error::Schema("en-tête CryXmlB tronqué".into()));
    }

    let word = |index: usize| -> usize {
        let at = 8 + index * 4;
        u32::from_le_bytes(data[at..at + 4].try_into().unwrap()) as usize
    };

    let node_offset = word(1);
    let node_count = word(2);
    let attr_offset = word(3);
    let attr_count = word(4);
    let string_offset = word(7);

    let read_string = |offset: usize| -> String {
        let start = string_offset.saturating_add(offset);
        if start >= data.len() {
            return String::new();
        }
        let end = data[start..]
            .iter()
            .position(|b| *b == 0)
            .map_or(data.len(), |n| start + n);
        String::from_utf8_lossy(&data[start..end]).into_owned()
    };

    // Table des attributs, lue d'un bloc : les nœuds y pointent par plage.
    let mut attributes = Vec::with_capacity(attr_count);
    for index in 0..attr_count {
        let at = attr_offset + index * ATTR_LEN;
        if at + ATTR_LEN > data.len() {
            return Err(Error::Schema("table d'attributs tronquée".into()));
        }
        let key = u32::from_le_bytes(data[at..at + 4].try_into().unwrap()) as usize;
        let value = u32::from_le_bytes(data[at + 4..at + 8].try_into().unwrap()) as usize;
        attributes.push((read_string(key), read_string(value)));
    }

    let mut nodes: Vec<Node> = Vec::with_capacity(node_count);
    for index in 0..node_count {
        let at = node_offset + index * NODE_LEN;
        if at + NODE_LEN > data.len() {
            return Err(Error::Schema("table de nœuds tronquée".into()));
        }
        let name = u32::from_le_bytes(data[at..at + 4].try_into().unwrap()) as usize;
        let content = u32::from_le_bytes(data[at + 4..at + 8].try_into().unwrap()) as usize;
        let n_attr = u16::from_le_bytes(data[at + 8..at + 10].try_into().unwrap()) as usize;
        let parent = i32::from_le_bytes(data[at + 12..at + 16].try_into().unwrap());
        let first_attr = u32::from_le_bytes(data[at + 16..at + 20].try_into().unwrap()) as usize;

        nodes.push(Node {
            name: read_string(name),
            content: read_string(content),
            first_attr,
            attr_count: n_attr,
            parent,
            children: Vec::new(),
        });
    }

    // Rattachement : chaque nœud connaît son parent, on reconstruit la
    // descendance dans l'ordre du fichier.
    let mut root = None;
    for index in 0..nodes.len() {
        let parent = nodes[index].parent;
        if parent < 0 || parent as usize >= nodes.len() || parent as usize == index {
            if root.is_none() {
                root = Some(index);
            }
        } else {
            nodes[parent as usize].children.push(index);
        }
    }
    let Some(root) = root else {
        return Err(Error::Schema("document CryXmlB sans racine".into()));
    };

    let mut out = String::with_capacity(data.len());
    out.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    write_node(&mut out, &nodes, root, &attributes, 0);
    Ok(out)
}

fn write_node(
    out: &mut String,
    nodes: &[Node],
    index: usize,
    attributes: &[(String, String)],
    depth: usize,
) {
    let node = &nodes[index];
    let name = if node.name.is_empty() {
        "node"
    } else {
        &node.name
    };

    for _ in 0..depth {
        out.push(' ');
    }
    out.push('<');
    out.push_str(name);

    // La plage d'attributs vient du fichier : on la borne avant de l'utiliser.
    let available = attributes.len().saturating_sub(node.first_attr);
    for (key, value) in attributes
        .iter()
        .skip(node.first_attr)
        .take(node.attr_count.min(available))
    {
        out.push(' ');
        out.push_str(key);
        out.push_str("=\"");
        escape_into(out, value);
        out.push('"');
    }

    if node.children.is_empty() && node.content.is_empty() {
        out.push_str("/>\n");
        return;
    }

    out.push('>');
    if !node.content.is_empty() {
        escape_into(out, &node.content);
    }
    if !node.children.is_empty() {
        out.push('\n');
        for child in &node.children {
            write_node(out, nodes, *child, attributes, depth + 1);
        }
        for _ in 0..depth {
            out.push(' ');
        }
    }
    out.push_str("</");
    out.push_str(name);
    out.push_str(">\n");
}

fn escape_into(out: &mut String, value: &str) {
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_passes_through() {
        // Tous les .xml de l'archive ne sont pas binaires ; l'appelant ne doit
        // pas avoir à le deviner.
        let text = b"<ActionMaps/>";
        assert_eq!(to_xml(text).unwrap(), "<ActionMaps/>");
        assert!(!is_cryxml(text));
    }

    #[test]
    fn truncated_header_is_refused() {
        let mut data = SIGNATURE.to_vec();
        data.push(0);
        assert!(to_xml(&data).is_err());
    }

    #[test]
    fn escaping_protects_attribute_values() {
        let mut out = String::new();
        escape_into(&mut out, r#"a & b < c > d " e ' f"#);
        assert_eq!(out, "a &amp; b &lt; c &gt; d &quot; e &apos; f");
    }
}
