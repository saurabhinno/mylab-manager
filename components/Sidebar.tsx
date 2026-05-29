'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar, Tooltip, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import {
  DashboardOutlined, ScienceOutlined, ArticleOutlined,
  PeopleOutlined, LogoutOutlined, LocalHospitalOutlined, PersonOutlined,
  SettingsOutlined, MenuOutlined, CloseOutlined, ChevronLeftOutlined, ChevronRightOutlined,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';
import LangSwitcher from '@/components/LangSwitcher';
import { useI18n } from '@/lib/i18n';

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

interface NavItem { label: string; href: string; icon: React.ReactNode; }

interface SidebarProps { role: 'doctor' | 'compounder'; email?: string; }

export default function Sidebar({ role, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
  }

  const doctorNav: NavItem[] = [
    { label: t('nav.dashboard'), href: '/doctor/dashboard', icon: <DashboardOutlined /> },
    { label: t('nav.tests'), href: '/doctor/tests', icon: <ScienceOutlined /> },
    { label: t('nav.reports'), href: '/doctor/reports', icon: <ArticleOutlined /> },
    { label: t('nav.staff'), href: '/doctor/staff', icon: <PeopleOutlined /> },
    { label: t('nav.settings'), href: '/doctor/settings', icon: <SettingsOutlined /> },
    { label: t('nav.profile'), href: '/doctor/profile', icon: <PersonOutlined /> },
  ];

  const compounderNav: NavItem[] = [
    { label: t('nav.compounder_reports'), href: '/compounder/reports', icon: <DashboardOutlined /> },
  ];

  const nav = role === 'doctor' ? doctorNav : compounderNav;
  const currentWidth = collapsed && !isMobile ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  async function handleLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ px: collapsed ? 1.5 : 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: 2, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalHospitalOutlined sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{t('app.name')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>{t('app.tagline')}</Typography>
            </Box>
          </Box>
        )}
        {collapsed && (
          <Box sx={{ width: 34, height: 34, borderRadius: 2, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalHospitalOutlined sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
        )}
        {isMobile && (
          <IconButton onClick={() => setMobileOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: collapsed ? 1 : 2 }} />

      {/* Nav */}
      <List sx={{ px: collapsed ? 0.8 : 1.5, pt: 2, flexGrow: 1 }}>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                <ListItemButton
                  component={Link}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  sx={{
                    borderRadius: 2, px: collapsed ? 1.5 : 1.5, py: 1,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                    '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
                    '&:focus-visible': { outline: '2px solid #fff', outlineOffset: 2, background: 'rgba(255,255,255,0.1)', color: '#fff' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit', justifyContent: 'center' }}>{item.icon}</ListItemIcon>
                  {!collapsed && <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: collapsed ? 1 : 2 }} />

      {/* Language Switcher */}
      <Box sx={{ px: collapsed ? 1 : 2, py: 1.5, display: 'flex', justifyContent: 'center' }}>
        <LangSwitcher collapsed={collapsed} />
      </Box>

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
        <Box sx={{ px: collapsed ? 1 : 2, pb: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <IconButton
            onClick={toggleCollapse}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightOutlined sx={{ fontSize: 18 }} /> : <ChevronLeftOutlined sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>
      )}

      {/* User */}
      <Box sx={{ px: collapsed ? 1 : 2, py: 2, display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          {email?.[0]?.toUpperCase() ?? 'U'}
        </Avatar>
        {!collapsed && (
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10 }}>
              {role === 'doctor' ? t('sidebar.doctor') : t('sidebar.compounder')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email ?? ''}
            </Typography>
          </Box>
        )}
        <Tooltip title={t('common.logout')}>
          <IconButton
            onClick={handleLogout}
            aria-label={t('common.logout')}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' }, '&:focus-visible': { outline: '2px solid #fff', outlineOffset: 2 } }}
          >
            <LogoutOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && (
        <Box sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1300, "@media print": { display: "none" } }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ bgcolor: '#0f4c81', color: '#fff', '&:hover': { bgcolor: '#0d3d6b' }, boxShadow: 2 }}>
            <MenuOutlined />
          </IconButton>
        </Box>
      )}

      {/* Desktop: permanent drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: currentWidth, flexShrink: 0, transition: 'width 0.2s',
            '& .MuiDrawer-paper': { width: currentWidth, transition: 'width 0.2s', boxSizing: 'border-box', background: 'linear-gradient(180deg, #0f4c81 0%, #0d3d6b 100%)', color: '#fff', border: 'none', overflowX: 'hidden' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile: temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
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
