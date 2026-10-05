use std::io::{self, Read};
use stem_visual_explorer_lib::search::resolver;
fn main() {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("query fixture input");
    let queries: Vec<String> = serde_json::from_str(&input).expect("query fixture array");
    let results: Vec<_> = queries.iter().map(|q| resolver::resolve(q)).collect();
    println!(
        "{}",
        serde_json::to_string(&results).expect("resolver output")
    );
}
