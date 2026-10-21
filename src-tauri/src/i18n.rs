//! Translations for the few texts shown by the backend itself: the tray menu
//! and desktop notifications. The window's texts live in `src/i18n`.

use serde::{Deserialize, Serialize};

use crate::model::Category;

/// The language chosen in Settings.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    /// Follow the desktop's language.
    #[default]
    Auto,
    En,
    Pt,
}

/// A language texts exist in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    En,
    Pt,
}

impl Language {
    /// The language to show, looking at the desktop's locale for `Auto`.
    pub fn resolve(self) -> Lang {
        match self {
            Language::En => Lang::En,
            Language::Pt => Lang::Pt,
            Language::Auto => from_locale(
                ["LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"]
                    .iter()
                    .filter_map(|var| std::env::var(var).ok())
                    .find(|value| !value.is_empty())
                    .as_deref(),
            ),
        }
    }
}

/// `pt_BR.UTF-8` → Portuguese; anything else → English.
fn from_locale(locale: Option<&str>) -> Lang {
    match locale {
        Some(l) if l.to_ascii_lowercase().starts_with("pt") => Lang::Pt,
        _ => Lang::En,
    }
}

pub struct TrayTexts {
    pub show: &'static str,
    pub pause: &'static str,
    pub quit: &'static str,
}

pub fn tray(lang: Lang) -> TrayTexts {
    match lang {
        Lang::En => TrayTexts {
            show: "Show ClipVault",
            pause: "Pause recording",
            quit: "Quit",
        },
        Lang::Pt => TrayTexts {
            show: "Mostrar o ClipVault",
            pause: "Pausar gravação",
            quit: "Sair",
        },
    }
}

/// Name of a category, as in notification titles.
pub fn category(category: Category, lang: Lang) -> &'static str {
    match (lang, category) {
        (Lang::En, _) => category.label(),
        (Lang::Pt, Category::Text) => "Texto",
        (Lang::Pt, Category::Link) => "Link",
        (Lang::Pt, Category::Image) => "Imagem",
        (Lang::Pt, Category::File) => "Arquivo",
        (Lang::Pt, Category::Folder) => "Pasta",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locale_picks_the_language() {
        assert_eq!(from_locale(Some("pt_BR.UTF-8")), Lang::Pt);
        assert_eq!(from_locale(Some("pt_PT")), Lang::Pt);
        assert_eq!(from_locale(Some("en_US.UTF-8")), Lang::En);
        assert_eq!(from_locale(Some("C")), Lang::En);
        assert_eq!(from_locale(None), Lang::En);
        assert_eq!(Language::Pt.resolve(), Lang::Pt);
    }

    #[test]
    fn language_is_stored_in_lowercase() {
        assert_eq!(serde_json::to_string(&Language::Pt).unwrap(), "\"pt\"");
        assert_eq!(
            serde_json::from_str::<Language>("\"auto\"").unwrap(),
            Language::Auto
        );
    }
}
