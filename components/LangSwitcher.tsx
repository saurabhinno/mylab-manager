'use client';

import { FormControl, Select, MenuItem } from '@mui/material';
import { LanguageOutlined } from '@mui/icons-material';
import { useI18n, Lang } from '@/lib/i18n';

export default function LangSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { lang, setLang, t } = useI18n();

  if (collapsed) {
    return (
      <Select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        size="small"
        variant="standard"
        disableUnderline
        sx={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: 11,
          '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' },
          '& .MuiSelect-select': { py: 0.5, px: 0.5, display: 'flex', alignItems: 'center' },
        }}
        renderValue={() => <LanguageOutlined sx={{ fontSize: 18 }} />}
      >
        <MenuItem value="en">English</MenuItem>
        <MenuItem value="hi">हिंदी</MenuItem>
        <MenuItem value="hinglish">Hinglish</MenuItem>
      </Select>
    );
  }

  return (
    <FormControl size="small" fullWidth>
      <Select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        variant="standard"
        disableUnderline
        startAdornment={<LanguageOutlined sx={{ fontSize: 16, mr: 1, color: 'rgba(255,255,255,0.6)' }} />}
        sx={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 13,
          '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' },
        }}
      >
        <MenuItem value="en">English</MenuItem>
        <MenuItem value="hi">हिंदी</MenuItem>
        <MenuItem value="hinglish">Hinglish</MenuItem>
      </Select>
    </FormControl>
  );
}
