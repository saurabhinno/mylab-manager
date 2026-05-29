'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { I18nProvider } from '@/lib/i18n';

const theme = createTheme({
  palette: {
    primary: { main: '#0f4c81' },
    secondary: { main: '#00897b' },
    background: { default: '#f0f4f8', paper: '#ffffff' },
    text: { primary: '#1a2332', secondary: '#4a5568' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          '&:focus-visible': { outline: '2px solid #0f4c81', outlineOffset: 2 },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #0f4c81 0%, #1565c0 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #0d3d6b 0%, #0f4c81 100%)' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { '&:focus-visible': { outline: '2px solid #0f4c81', outlineOffset: 2 } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, '&:focus-visible': { outline: '2px solid #0f4c81', outlineOffset: 2 } },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { '&:focus-visible': { outline: '2px solid #0f4c81', outlineOffset: -2 } },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } } },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' } },
    },
    MuiPaper: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:focus-within': { backgroundColor: 'rgba(15, 76, 129, 0.04)' } },
      },
    },
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
