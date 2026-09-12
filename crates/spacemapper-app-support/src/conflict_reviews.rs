//! Local observations, scoped to one profile and exact pairs of bindings.
//! The external notebook is never needed at runtime; importing it is explicit.
use serde::{Deserialize, Serialize};
use spacemapper_core::channel;
use std::path::Path;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TriggerSignature {
    ContinuousAxis,
    Button {
        onpress: bool,
        onhold: bool,
        onrelease: bool,
        multitap: f64,
        presstriggerthreshold: f64,
        releasetriggerthreshold: f64,
        holdtriggerdelay: f64,
        releasetriggerdelay: f64,
    },
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ReviewAction {
    pub actionmap: String,
    pub action: String,
    pub trigger_signature: TriggerSignature,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewVerdict {
    FalseAlarm,
    RealConflict,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConflictReview {
    pub control: String,
    pub actions: [ReviewAction; 2],
    pub verdict: ReviewVerdict,
}

#[derive(Deserialize)]
struct ProfileReviews {
    profile_path: String,
    reviews: Vec<ConflictReview>,
}

#[derive(Deserialize)]
struct ReviewFile {
    schema_version: u32,
    profiles: Vec<ProfileReviews>,
}

fn profile_identity(path: &Path) -> String {
    let path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let text = path.to_string_lossy().replace('\\', "/");
    let text = text.strip_prefix("//?/").unwrap_or(&text);
    if cfg!(windows) {
        text.to_lowercase()
    } else {
        text.to_string()
    }
}

fn parse_reviews(text: &str, profile: &Path) -> Result<Vec<ConflictReview>, String> {
    let data: ReviewFile = serde_json::from_str(text)
        .map_err(|_| "Fichier de retours de diagnostic illisible.".to_string())?;
    if data.schema_version != 1 {
        return Err("Version des retours de diagnostic non prise en charge.".to_string());
    }
    let identity = profile_identity(profile);
    let mut reviews = Vec::new();
    for entry in data.profiles {
        if profile_identity(Path::new(&entry.profile_path)) != identity {
            continue;
        }
        for review in entry.reviews {
            if review.control.trim().is_empty()
                || review.control.len() > 512
                || review.actions.iter().any(|a| {
                    a.actionmap.is_empty()
                        || a.action.is_empty()
                        || a.actionmap.len() > 256
                        || a.action.len() > 256
                })
                || (review.actions[0].actionmap == review.actions[1].actionmap
                    && review.actions[0].action == review.actions[1].action)
            {
                return Err("Une paire de retours de diagnostic est invalide.".to_string());
            }
            reviews.push(review);
        }
    }
    Ok(reviews)
}

/// Missing file means no imported observations. Invalid data stays visible as
/// an error rather than silently claiming that the observations were applied.
pub fn load(app_name: &str, profile: &Path) -> (Vec<ConflictReview>, Option<String>) {
    let Some(dir) = channel::data_dir(app_name) else {
        return (Vec::new(), None);
    };
    let path = dir.join("conflict-reviews.json");
    let result = (|| {
        let metadata = match std::fs::metadata(&path) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(_) => return Err("Les retours de diagnostic sont inaccessibles.".to_string()),
        };
        if metadata.len() > 4 * 1024 * 1024 {
            return Err("Le fichier de retours de diagnostic est trop volumineux.".to_string());
        }
        let text = std::fs::read_to_string(&path)
            .map_err(|_| "Impossible de lire les retours de diagnostic.".to_string())?;
        parse_reviews(&text, profile)
    })();
    match result {
        Ok(reviews) => (reviews, None),
        Err(error) => (Vec::new(), Some(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> String {
        serde_json::json!({"schema_version":1,"profiles":[{"profile_path":"C:/example/actionmaps.xml",
            "reviews":[{"control":"js2_y","actions":[
                {"actionmap":"vehicle_driver","action":"v_move","trigger_signature":{"kind":"continuous_axis"}},
                {"actionmap":"vehicle_general","action":"v_view_pitch","trigger_signature":{"kind":"continuous_axis"}}],
                "verdict":"real_conflict"}]}]}).to_string()
    }
    #[test]
    fn observations_are_not_applied_to_another_profile() {
        assert_eq!(
            parse_reviews(&sample(), Path::new("C:/example/actionmaps.xml"))
                .unwrap()
                .len(),
            1
        );
        assert!(
            parse_reviews(&sample(), Path::new("C:/other/actionmaps.xml"))
                .unwrap()
                .is_empty()
        );
    }
    #[test]
    fn untested_or_incomplete_observations_are_rejected() {
        assert!(parse_reviews(
            &sample().replace("real_conflict", "untested"),
            Path::new("C:/example/actionmaps.xml")
        )
        .is_err());
        assert!(parse_reviews(
            &sample().replace("continuous_axis", "button"),
            Path::new("C:/example/actionmaps.xml")
        )
        .is_err());
    }
}
