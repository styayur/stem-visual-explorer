use crate::models::{NormalizedQuery, ParsedQuery};
use std::collections::BTreeSet;

/// A deterministic bilingual (Chinese <-> English) synonym dictionary.
///
/// Keys are lowercased source terms; values are the expanded token set. No
/// machine learning is involved: this is pure local synonym expansion.
fn synonym_groups() -> Vec<(&'static str, &'static str)> {
    vec![
        ("梯度", "gradient"),
        ("旋度", "curl"),
        ("散度", "divergence"),
        ("驻波", "standing wave"),
        ("简谐振动", "harmonic oscillator"),
        ("高斯定理", "gauss theorem"),
        ("高斯定理", "divergence theorem"),
        ("斯托克斯", "stokes theorem"),
        ("方向导数", "directional derivative"),
        ("电磁感应", "electromagnetic induction"),
        ("电磁波", "electromagnetic wave"),
        ("电磁场", "electromagnetic field"),
        ("电场", "electric field"),
        ("磁场", "magnetic field"),
        ("量子力学", "quantum mechanics"),
        ("量子", "quantum"),
        ("傅里叶", "fourier"),
        ("傅立叶", "fourier"),
        ("波动方程", "wave equation"),
        ("热力学", "thermodynamics"),
        ("力学", "mechanics"),
        ("光学", "optics"),
        ("相对论", "relativity"),
        ("导数", "derivative"),
        ("积分", "integral"),
        ("向量", "vector"),
        ("矢量", "vector"),
        ("矩阵", "matrix"),
        ("特征值", "eigenvalue"),
        ("微分方程", "differential equation"),
        ("偏导数", "partial derivative"),
        ("多重积分", "multiple integral"),
        ("傅里叶变换", "fourier transform"),
        ("简谐运动", "simple harmonic motion"),
        ("单摆", "pendulum"),
        ("波", "wave"),
        ("干涉", "interference"),
        ("衍射", "diffraction"),
        ("折射", "refraction"),
        ("反射", "reflection"),
        ("动量", "momentum"),
        ("能量", "energy"),
        ("熵", "entropy"),
        ("电势", "electric potential"),
        ("电路", "circuit"),
        ("电容", "capacitor"),
        ("电感", "inductor"),
        ("电阻", "resistance"),
        ("电流", "current"),
        ("电压", "voltage"),
        ("频率", "frequency"),
        ("波长", "wavelength"),
        ("振幅", "amplitude"),
        ("概率", "probability"),
        ("统计", "statistics"),
        ("拓扑", "topology"),
        ("流体", "fluid"),
        ("波动", "wave motion"),
        ("振动", "oscillation"),
        ("振荡", "oscillation"),
        ("谐振", "resonance"),
        ("光速", "speed of light"),
        ("加速度", "acceleration"),
        ("速度", "velocity"),
        ("位移", "displacement"),
        ("駐波", "standing wave"),
        ("簡諧振動", "harmonic oscillator"),
        ("電磁感應", "electromagnetic induction"),
        ("電場", "electric field"),
        ("磁場", "magnetic field"),
        ("傅里葉", "fourier"),
        ("傅立葉", "fourier"),
        ("導數", "derivative"),
        ("積分", "integral"),
    ]
}

/// Expand a raw parsed query into normalized tokens. English and Chinese are
/// both preserved, and every known synonym is added to the token set.
pub fn expand(parsed: &ParsedQuery) -> NormalizedQuery {
    let mut set: BTreeSet<String> = BTreeSet::new();

    for term in &parsed.terms {
        let lower = term.to_lowercase();
        add_with_synonyms(&lower, &mut set);
    }

    for phrase in &parsed.phrases {
        let lower = phrase.to_lowercase();
        add_with_synonyms(&lower, &mut set);
    }

    for size in 2..=4 {
        for terms in parsed.terms.windows(size) {
            let phrase = terms.join(" ").to_lowercase();
            if synonym_groups()
                .iter()
                .any(|(from, to)| *from == phrase || *to == phrase)
            {
                add_with_synonyms(&phrase, &mut set);
            }
        }
    }

    NormalizedQuery {
        raw: parsed.raw.clone(),
        tokens: set.into_iter().collect(),
        phrases: parsed.phrases.clone(),
        site_filter: parsed.site_filter.clone(),
        type_filter: parsed.type_filter,
    }
}

fn add_with_synonyms(term: &str, set: &mut BTreeSet<String>) {
    let trimmed = term.trim();
    if trimmed.is_empty() {
        return;
    }
    // Always keep the original token.
    set.insert(trimmed.to_string());

    // Add all synonym targets. We iterate rather than recurse to keep the
    // expansion bounded and deterministic.
    let mut queue: Vec<String> = vec![trimmed.to_string()];
    while let Some(current) = queue.pop() {
        for (from, to) in synonym_groups() {
            if current == *from || current == from.to_lowercase() {
                for part in to.split_whitespace() {
                    let p = part.to_lowercase();
                    if set.insert(p.clone()) {
                        queue.push(p);
                    }
                }
                let full = to.to_lowercase();
                if set.insert(full.clone()) {
                    queue.push(full);
                }
            }
            if current == *to || current == to.to_lowercase() {
                let full = from.to_lowercase();
                if set.insert(full.clone()) {
                    queue.push(full);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn expand_terms(terms: &[&str]) -> Vec<String> {
        let parsed = ParsedQuery {
            raw: terms.join(" "),
            terms: terms.iter().map(|s| s.to_string()).collect(),
            phrases: vec![],
            site_filter: None,
            type_filter: None,
        };
        expand(&parsed).tokens
    }

    #[test]
    fn expands_chinese_gradient() {
        let t = expand_terms(&["梯度"]);
        assert!(t.iter().any(|x| x == "gradient"));
        assert!(t.iter().any(|x| x == "梯度"));
    }

    #[test]
    fn expands_chinese_curl() {
        let t = expand_terms(&["旋度"]);
        assert!(t.iter().any(|x| x == "curl"));
    }

    #[test]
    fn expands_standing_wave() {
        let t = expand_terms(&["驻波"]);
        assert!(t.iter().any(|x| x == "standing"));
        assert!(t.iter().any(|x| x == "wave"));
    }

    #[test]
    fn english_term_is_kept() {
        let t = expand_terms(&["curl"]);
        assert!(t.contains(&"curl".to_string()));
    }

    #[test]
    fn mixed_query_expands_both() {
        let t = expand_terms(&["旋度", "curl"]);
        assert!(t.contains(&"旋度".to_string()));
        assert!(t.contains(&"curl".to_string()));
    }
}
