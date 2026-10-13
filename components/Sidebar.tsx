'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar, Tooltip, IconButton, useMediaQuery, useTheme,
  Menu, MenuItem,
} from '@mui/material';
import {
  DashboardOutlined, ScienceOutlined, ArticleOutlined,
  PeopleOutlined, LogoutOutlined, LocalHospitalOutlined, PersonOutlined,
  SettingsOutlined, MenuOutlined, CloseOutlined, ChevronLeftOutlined, ChevronRightOutlined,
  BiotechOutlined, SwapHorizOutlined, CloudOutlined, SystemUpdateAltOutlined,
  LockOutlined,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';
import LangSwitcher from '@/components/LangSwitcher';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [viewAs, setViewAs] = useState<'doctor' | 'compounder'>(role);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const { t } = useI18n();
  const isDesktop = typeof window !== 'undefined' && !!(window as any).mylab?.updates;

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  // Detect current view based on pathname
  useEffect(() => {
    if (pathname.startsWith('/compounder')) {
      setViewAs('compounder');
    } else if (pathname.startsWith('/doctor')) {
      setViewAs('doctor');
    }
  }, [pathname]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
  }

  function switchRole() {
    if (viewAs === 'doctor') {
      router.push('/compounder/reports');
    } else {
      router.push('/doctor/dashboard');
    }
  }

  const doctorNav: NavItem[] = [
    { label: t('nav.dashboard'), href: '/doctor/dashboard', icon: <DashboardOutlined /> },
    { label: t('nav.tests'), href: '/doctor/tests', icon: <ScienceOutlined /> },
    { label: t('nav.reports'), href: '/doctor/reports', icon: <ArticleOutlined /> },
    { label: t('nav.staff'), href: '/doctor/staff', icon: <PeopleOutlined /> },
    { label: t('nav.settings'), href: '/doctor/settings', icon: <SettingsOutlined /> },
    { label: t('nav.cloud'), href: '/doctor/cloud', icon: <CloudOutlined /> },
    { label: t('nav.profile'), href: '/doctor/profile', icon: <PersonOutlined /> },
  ];

  const compounderNav: NavItem[] = [
    { label: t('nav.compounder_reports'), href: '/compounder/reports', icon: <BiotechOutlined /> },
  ];

  const nav = viewAs === 'doctor' ? doctorNav : compounderNav;
  const currentWidth = collapsed && !isMobile ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  async function handleLogout() {
    setAnchorEl(null);
    await apiRequest('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleCheckUpdate() {
    setAnchorEl(null);
    if (!(window as any).mylab?.updates?.check) return;
    setCheckingUpdate(true);
    try {
      await (window as any).mylab.updates.check();
    } finally {
      setCheckingUpdate(false);
    }
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top: Logo + Collapse toggle */}
      <Box sx={{ px: collapsed ? 1.5 : 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalHospitalOutlined sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          {!collapsed && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{t('app.name')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>{t('app.tagline')}</Typography>
            </Box>
          )}
        </Box>
        {isMobile ? (
          <IconButton onClick={() => setMobileOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        ) : !collapsed ? (
          <IconButton onClick={toggleCollapse} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }} aria-label="Collapse sidebar">
            <ChevronLeftOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        ) : null}
      </Box>

      {collapsed && !isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <IconButton onClick={toggleCollapse} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }} aria-label="Expand sidebar">
            <ChevronRightOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: collapsed ? 1 : 2 }} />

      {/* Role switcher for doctors */}
      {role === 'doctor' && (
        <Box sx={{ px: collapsed ? 0.8 : 1.5, pt: 1.5 }}>
          <Tooltip title={collapsed ? (viewAs === 'doctor' ? t('nav.switch_to_compounder') : t('nav.switch_to_doctor')) : ''} placement="right">
            <ListItemButton
              onClick={switchRole}
              sx={{
                borderRadius: 2, px: collapsed ? 1.5 : 1.5, py: 0.8,
                justifyContent: collapsed ? 'center' : 'flex-start',
                bgcolor: 'rgba(255,255,255,0.08)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: '#4dd0e1', justifyContent: 'center' }}>
                <SwapHorizOutlined sx={{ fontSize: 20 }} />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={viewAs === 'doctor' ? t('nav.switch_to_compounder') : t('nav.switch_to_doctor')}
                  primaryTypographyProps={{ fontSize: 12, fontWeight: 500, color: '#4dd0e1' }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </Box>
      )}

      {/* Nav */}
      <List sx={{ px: collapsed ? 0.8 : 1.5, pt: 1.5, flexGrow: 1 }}>
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

      {/* User - click for logout menu */}
      <Box sx={{ px: collapsed ? 1 : 2, py: 2, display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <Tooltip title={collapsed ? (email ?? '') : ''} placement="right">
          <Avatar
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 13, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' } }}
          >
            {email?.[0]?.toUpperCase() ?? 'U'}
          </Avatar>
        </Tooltip>
        {!collapsed && (
          <Box sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10 }}>
              {viewAs === 'doctor' ? t('sidebar.doctor') : t('sidebar.compounder')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email ?? ''}
            </Typography>
          </Box>
        )}
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <MenuItem onClick={() => { setAnchorEl(null); setPwOpen(true); }} sx={{ gap: 1.5, fontSize: 14 }}>
          <LockOutlined sx={{ fontSize: 18 }} />
          {t('password.change_title')}
        </MenuItem>
        {isDesktop && (
          <MenuItem onClick={handleCheckUpdate} disabled={checkingUpdate} sx={{ gap: 1.5, fontSize: 14 }}>
            <SystemUpdateAltOutlined sx={{ fontSize: 18 }} />
            {checkingUpdate ? t('nav.checking_update') : t('nav.check_update')}
          </MenuItem>
        )}
        <MenuItem onClick={handleLogout} sx={{ gap: 1.5, fontSize: 14 }}>
          <LogoutOutlined sx={{ fontSize: 18 }} />
          {t('common.logout')}
        </MenuItem>
      </Menu>

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </Box>
  );

  return (
    <>
      {isMobile && (
        <Box sx={{ position: 'fixed', top: 12, left: 12, zIndex: 1300, "@media print": { display: "none" } }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ bgcolor: '#0f4c81', color: '#fff', '&:hover': { bgcolor: '#0d3d6b' }, boxShadow: 2 }}>
            <MenuOutlined />
          </IconButton>
        </Box>
      )}

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

      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', background: 'linear-gradient(180deg, #0f4c81 0%, #0d3d6b 100%)', color: '#fff', border: 'none' } }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
