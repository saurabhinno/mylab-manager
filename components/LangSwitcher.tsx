'use client';

import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useI18n, Lang } from '@/lib/i18n';

export default function LangSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();

  return (
    <ToggleButtonGroup
      value={lang}
      exclusive
      onChange={(_, v) => v && setLang(v as Lang)}
      size="small"
      sx={{ "& .MuiToggleButton-root": { px: compact ? 1 : 1.5, py: 0.5, fontSize: compact ? 11 : 12, textTransform: "none" } }}
    >
      <ToggleButton value="en">EN</ToggleButton>
      <ToggleButton value="hi">हिं</ToggleButton>
      <ToggleButton value="hinglish">Hi-En</ToggleButton>
    </ToggleButtonGroup>
  );
}
