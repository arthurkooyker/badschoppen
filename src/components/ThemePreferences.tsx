import type { ThemeSettings } from "../types"

type ThemePreset = {
  name: string
  description: string
  settings: ThemeSettings
}

type Props = {
  themeSettings: ThemeSettings
  themePresets: ThemePreset[]
  applyThemePreset: (settings: ThemeSettings) => void
  updateThemeSetting: (key: keyof ThemeSettings, value: string) => void
  resetThemeSettings: () => void
}

const themeFields: Array<{
  key: keyof ThemeSettings
  label: string
  description: string
}> = [
  {
    key: "appBackground",
    label: "Achtergrond",
    description: "De hoofdkleur van de app-achtergrond."
  },
  {
    key: "appBackgroundAccent",
    label: "Achtergrondaccent",
    description: "De tweede kleur in de achtergrondverloop."
  },
  {
    key: "panelBackground",
    label: "Panelen",
    description: "De kleur van de grote vlakken en kaarten."
  },
  {
    key: "textPrimary",
    label: "Tekst",
    description: "De hoofdkleur van koppen en gewone tekst."
  },
  {
    key: "inputBackground",
    label: "Invulvelden",
    description: "De achtergrondkleur van invoervelden."
  },
  {
    key: "inputText",
    label: "Invultekst",
    description: "De tekstkleur binnen invoervelden."
  },
  {
    key: "accent",
    label: "Accent",
    description: "De hoofdkleur van knoppen en actieve elementen."
  },
  {
    key: "accentStrong",
    label: "Accent donker",
    description: "De donkerdere variant voor hover en verloop."
  }
]

function ThemePreferences({
  themeSettings,
  themePresets,
  applyThemePreset,
  updateThemeSetting,
  resetThemeSettings
}: Props) {
  return (
    <div className="app-grid">
      <div className="panel panel-recipes" style={{ width: 420 }}>
        <h3>Vormgeving</h3>

        <div className="panel-content">
          <p className="muted-text">
            Pas hier de kleuren van de app aan. Elke wijziging wordt meteen bewaard
            en direct zichtbaar.
          </p>

          <div className="theme-preset-section">
            <h4>Standaardthema's</h4>

            <div className="theme-preset-grid">
              {themePresets.map((preset) => (
                <div key={preset.name} className="preference-card theme-preset-card">
                  <strong>{preset.name}</strong>
                  <p className="muted-text">{preset.description}</p>

                  <div className="theme-preset-swatches">
                    <span style={{ background: preset.settings.appBackground }} />
                    <span style={{ background: preset.settings.panelBackground }} />
                    <span style={{ background: preset.settings.accent }} />
                    <span style={{ background: preset.settings.accentStrong }} />
                  </div>

                  <button
                    type="button"
                    onClick={() => applyThemePreset(preset.settings)}
                  >
                    Gebruik dit thema
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="preferences-grid">
            {themeFields.map((field) => (
              <div key={field.key} className="preference-card">
                <label className="theme-field">
                  <span>{field.label}</span>

                  <div className="theme-field-controls">
                    <input
                      className="color-picker"
                      type="color"
                      value={themeSettings[field.key]}
                      onChange={(e) => updateThemeSetting(field.key, e.target.value)}
                    />

                    <input
                      value={themeSettings[field.key]}
                      onChange={(e) => updateThemeSetting(field.key, e.target.value)}
                    />
                  </div>
                </label>

                <p className="muted-text">{field.description}</p>
              </div>
            ))}
          </div>

          <button type="button" onClick={resetThemeSettings}>
            Originele standaard herstellen
          </button>
        </div>
      </div>

      <div className="panel panel-route" style={{ flex: 1 }}>
        <h3>Voorbeeld</h3>

        <div className="panel-content">
          <div className="theme-preview">
            <div className="theme-preview-header">
              <div>
                <strong>Boodschappenpaneel</strong>
                <p className="muted-text">Zo ziet een deel van de app er ongeveer uit.</p>
              </div>

              <button type="button">Voorbeeldknop</button>
            </div>

            <div className="theme-preview-filters">
              <span className="preview-chip">vegetarisch</span>
              <span className="preview-chip">snel</span>
              <span className="preview-chip">weekend</span>
            </div>

            <div className="theme-preview-fields">
              <input value="Paprika" readOnly />
              <input value="2" readOnly />
              <select value="stuk" disabled>
                <option value="stuk">stuk</option>
              </select>
            </div>

            <textarea
              readOnly
              value="Bijvoorbeeld notities of extra benodigdheden."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ThemePreferences
