import { useState } from "react";

import { useCustomThemes } from "~/hooks/useCustomThemes";
import { useTheme } from "~/hooks/useTheme";
import { ThemeLibrary } from "./ThemeSettings";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

export function DocumentAppearanceSettings() {
  const {
    appearanceMode,
    refreshTheme,
    resolvedTheme,
    setAppearanceMode,
    setTheme,
    setThemeHalf,
    theme,
    themeHalves,
  } = useTheme();
  const customThemes = useCustomThemes();
  const [isImportOpen, setImportOpen] = useState(false);

  return (
    <SettingsPageContainer>
      <SettingsSection title="Colors & themes" variant="plain">
        <ThemeLibrary
          appearanceMode={appearanceMode}
          customThemes={customThemes}
          initialAppearance={resolvedTheme}
          refreshTheme={refreshTheme}
          isImportOpen={isImportOpen}
          setAppearanceMode={setAppearanceMode}
          setTheme={setTheme}
          setThemeHalf={setThemeHalf}
          theme={theme}
          themeHalves={themeHalves}
          onImportOpenChange={setImportOpen}
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
