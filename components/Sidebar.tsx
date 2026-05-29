'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar, Tooltip, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import {
  DashboardOutlined, ScienceOutlined, ArticleOutlined,
  PeopleOutlined, LogoutOutlined, LocalHospitalOutlined, PersonOutlined,
  SettingsOutlined, MenuOutlined, CloseOutlined,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';
import LangSwitcher from '@/components/LangSwitcher';
import { useI18n } from '@/lib/i18n';

const DRAWER_WIDTH = 240;

interface NavItem { label: string; href: string; icon: React.ReactNode; }

const doctorNav: NavItem[] = [
  { label: 'Dashboard', href: '/doctor/dashboard', icon: <DashboardOutlined /> },
  { label: 'Test Catalogue', href: '/doctor/tests', icon: <ScienceOutlined /> },
  { label: 'All Reports', href: '/doctor/reports', icon: <ArticleOutlined /> },
  { label: 'Staff', href: '/doctor/staff', icon: <PeopleOutlined /> },
  { label: 'Report Settings', href: '/doctor/settings', icon: <SettingsOutlined /> },
  { label: 'Profile', href: '/doctor/profile', icon: <PersonOutlined /> },
];

const compounderNav: NavItem[] = [
  { label: 'Reports', href: '/compounder/reports', icon: <DashboardOutlined /> },
];

interface SidebarProps { role: 'doctor' | 'compounder'; email?: string; }

export default function Sidebar({ role, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const nav = role === 'doctor' ? doctorNav : compounderNav;

  async function handleLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const drawerContent = (
    <>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalHospitalOutlined sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>MyLab</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>Diagnostics Portal</Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      {/* Nav */}
      <List sx={{ px: 1.5, pt: 2, flexGrow: 1 }}>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                onClick={() => isMobile && setOpen(false)}
                sx={{
                  borderRadius: 2, px: 1.5, py: 1,
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
                  '&:focus-visible': { outline: '2px solid #fff', outlineOffset: 2, background: 'rgba(255,255,255,0.1)', color: '#fff' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      {/* Language Switcher */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'center' }}>
        <LangSwitcher compact />
      </Box>

      {/* User */}
      <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          {email?.[0]?.toUpperCase() ?? 'U'}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10 }}>
            {role === 'doctor' ? 'Doctor' : 'Compounder'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email ?? ''}
          </Typography>
        </Box>
        <Tooltip title="Logout">
          <IconButton
            onClick={handleLogout}
            aria-label="Logout"
            size="small"
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' }, '&:focus-visible': { outline: '2px solid #fff', outlineOffset: 2 } }}
          >
            <LogoutOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && (
        <Box sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1300, "@media print": { display: "none" } }}>
          <IconButton onClick={() => setOpen(true)} sx={{ bgcolor: '#0f4c81', color: '#fff', '&:hover': { bgcolor: '#0d3d6b' }, boxShadow: 2 }}>
            <MenuOutlined />
          </IconButton>
        </Box>
      )}

      {/* Desktop: permanent drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH, flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', background: 'linear-gradient(180deg, #0f4c81 0%, #0d3d6b 100%)', color: '#fff', border: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile: temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', background: 'linear-gradient(180deg, #0f4c81 0%, #0d3d6b 100%)', color: '#fff', border: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
