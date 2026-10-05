use super::data;
use unicode_normalization::UnicodeNormalization;
pub fn query(raw: &str) -> String {
    let replaced: String = raw
        .chars()
        .map(|c| {
            data::rules()
                .characters
                .get(&c.to_string())
                .cloned()
                .unwrap_or_else(|| c.to_string())
        })
        .collect();
    let folded: String = replaced.nfkc().collect::<String>().to_lowercase();
    let post_fold: String = folded
        .chars()
        .map(|c| {
            data::rules()
                .characters
                .get(&c.to_string())
                .cloned()
                .unwrap_or_else(|| c.to_string())
        })
        .collect();
    let scripts: String = post_fold
        .chars()
        .map(|c| {
            data::rules()
                .scripts
                .get(&c.to_string())
                .cloned()
                .unwrap_or_else(|| c.to_string())
        })
        .collect();
    scripts
        .replace(['’', '‘'], "'")
        .replace(['‐', '‑', '–', '—', '−'], "-")
        .replace(['，', '、', '；', '：', '！', '？'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
pub fn strip(text: &str) -> String {
    let mut text = text.to_string();
    for p in &data::patterns().scaffolds {
        text = p.replace_all(&text, " ").into();
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}
pub fn tokens(text: &str) -> Vec<String> {
    data::patterns()
        .tokenizer
        .find_iter(text)
        .map(|m| m.as_str().into())
        .collect()
}
