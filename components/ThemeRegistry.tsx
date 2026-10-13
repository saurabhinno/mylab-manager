'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { I18nProvider } from '@/lib/i18n';

const theme = createTheme({
  palette: {
    primary: { main: '#0f4c81', contrastText: '#ffffff' },
    secondary: { main: '#00897b', contrastText: '#ffffff' },
    success: { main: '#2e7d32', contrastText: '#ffffff' },
    error: { main: '#d32f2f', contrastText: '#ffffff' },
    warning: { main: '#ed6c02', contrastText: '#ffffff' },
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
        // Filled primary: white label on blue (readable + stays white on hover)
        containedPrimary: {
          color: '#ffffff',
          background: 'linear-gradient(135deg, #0f4c81 0%, #1565c0 100%)',
          '&:hover': {
            color: '#ffffff',
            background: 'linear-gradient(135deg, #0d3d6b 0%, #0f4c81 100%)',
          },
        },
        containedSecondary: {
          color: '#ffffff',
          '&:hover': { color: '#ffffff' },
        },
        containedSuccess: {
          color: '#ffffff',
          '&:hover': { color: '#ffffff' },
        },
        containedError: {
          color: '#ffffff',
          '&:hover': { color: '#ffffff' },
        },
        containedWarning: {
          color: '#ffffff',
          '&:hover': { color: '#ffffff' },
        },
        // Outlined / text: dark primary label (not white — would vanish on light bg)
        outlinedPrimary: {
          color: '#0f4c81',
          borderColor: '#0f4c81',
          '&:hover': {
            color: '#0f4c81',
            borderColor: '#0d3d6b',
            backgroundColor: 'rgba(15, 76, 129, 0.06)',
          },
        },
        textPrimary: {
          color: '#0f4c81',
          '&:hover': {
            color: '#0f4c81',
            backgroundColor: 'rgba(15, 76, 129, 0.06)',
          },
        },
        outlinedSecondary: {
          color: '#00897b',
          '&:hover': { color: '#00897b' },
        },
        textSecondary: {
          color: '#00897b',
          '&:hover': { color: '#00897b' },
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
