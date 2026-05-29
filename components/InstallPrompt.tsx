'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Typography, IconButton } from '@mui/material';
import { InstallDesktopOutlined, CloseOutlined } from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem('pwa-dismissed', '1');
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <Box sx={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1300,
      bgcolor: '#0f4c81',
      color: '#fff',
      borderRadius: 3,
      px: 3,
      py: 1.5,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      maxWidth: 420,
      width: 'calc(100% - 32px)',
    }}>
      <InstallDesktopOutlined sx={{ fontSize: 28 }} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Install MyLab</Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.8 }}>Add to desktop for quick access</Typography>
      </Box>
      <Button
        variant="contained"
        size="small"
        onClick={handleInstall}
        sx={{ bgcolor: '#fff', color: '#0f4c81', fontWeight: 700, '&:hover': { bgcolor: '#e8f0fe' } }}
      >
        Install
      </Button>
      <IconButton size="small" onClick={handleDismiss} sx={{ color: 'rgba(255,255,255,0.6)' }}>
        <CloseOutlined sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
}
