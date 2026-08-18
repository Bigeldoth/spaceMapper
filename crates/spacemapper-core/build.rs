fn main() {
    // Sans ceci, cargo ne recompilerait pas le crate quand le canal change :
    // on obtiendrait un binaire staging embarquant la constante `production`.
    println!("cargo:rerun-if-env-changed=SPACEMAPPER_CHANNEL");
}
