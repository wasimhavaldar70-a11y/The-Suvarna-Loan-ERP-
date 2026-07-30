'use client';

// ========================================================
// SuvarnaLoan ERP - Multi-Tenant Light Theme Login Screen
// Location: src/app/login/page.tsx
// ========================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, ShieldCheck, UserCheck, ArrowRight, Lock, Sparkles, Building2, Send, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { setSessionUser, supabase, isRealSupabase } from '../../lib/supabase/client';
import { db } from '../../lib/supabase/supabaseDb';
import { UserRole, User, Shop } from '../../types';
import { logAuditEvent } from '../../lib/auditLog';
import { validateEmail } from '../../lib/validation';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activationSent, setActivationSent] = useState(false);

  const handleRequestActivation = async () => {
    if (!validateEmail(email)) {
      setErrorMsg('❌ Please enter a valid email format to request account activation.');
      return;
    }
    toast.loading(`Sending account activation request for ${email}...`);
    await logAuditEvent('platform', 'guest', email, 'ACTIVATION_REQUEST', 'shops', email);
    toast.dismiss();
    setActivationSent(true);
    toast.success(`Account activation request sent to Super Admin!`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!validateEmail(email)) {
      setErrorMsg('❌ Invalid Email Format: Please enter a valid email address (e.g. owner@laxmigold.com)');
      setLoading(false);
      return;
    }

    try {
      let cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      // ── Step 1: Authenticate via Supabase Auth (MANDATORY) ──
      if (!isRealSupabase || !supabase) {
        setErrorMsg('❌ Authentication service is not configured. Please contact Super Admin.');
        setLoading(false);
        return;
      }

      // Build email alias fallbacks (handles jewellers vs jewlers spelling differences)
      const emailAliases: string[] = [cleanEmail];
      if (cleanEmail.includes('jewellers')) {
        emailAliases.push(cleanEmail.replace('jewellers', 'jewlers'));
      } else if (cleanEmail.includes('jewlers')) {
        emailAliases.push(cleanEmail.replace('jewlers', 'jewellers'));
      }

      let authUser: any = null;
      let lastAuthErr: string = '';

      try {
        for (const targetEmail of emailAliases) {
          const { data: authData, error } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: cleanPassword,
          });
          if (!error && authData?.user) {
            authUser = authData.user;
            cleanEmail = targetEmail;
            break;
          } else if (error) {
            lastAuthErr = error.message;
          }
        }

        if (!authUser) {
          setErrorMsg(`❌ Invalid Credentials: ${lastAuthErr || 'Invalid login credentials'}`);
          setLoading(false);
          return;
        }
      } catch (authErr: any) {
        setErrorMsg(`❌ Authentication Error: ${authErr?.message || 'Unable to connect to auth service.'}`);
        setLoading(false);
        return;
      }

      if (!authUser) {
        setErrorMsg('❌ Authentication failed. No user returned from auth service.');
        setLoading(false);
        return;
      }

      // ── Step 2: Determine role EXCLUSIVELY from authenticated user's stored metadata ──
      const authRole = authUser.user_metadata?.role as UserRole | undefined;
      const authShopId = authUser.user_metadata?.shop_id as string | null | undefined;
      const authName = authUser.user_metadata?.name as string | undefined;

      // ── Step 3: Route based on authoritative role from database ──
      if (authRole === 'Super Admin') {
        // Super Admin: Build session from real auth data, NO fabrication
        const saUser: User = {
          id: authUser.id,
          shop_id: null,
          name: authName || 'Super Admin',
          role: 'Super Admin',
          email: cleanEmail,
          created_at: authUser.created_at || new Date().toISOString(),
        };
        setSessionUser({ user: saUser, shop: null });
        await logAuditEvent('platform', saUser.id, saUser.name, 'LOGIN', 'users', saUser.id);
        router.push('/admin/dashboard');
        return;
      }

      // ── Step 4: Shop Owner / Staff — Resolve tenant shop ──
      let shop: Shop | null = null;
      let user: User | null = null;

      // 4a. Resolve shop_id from Auth JWT user_metadata
      if (authShopId) {
        const freshShop = await db.getShop(authShopId);
        if (freshShop) {
          shop = freshShop;
          user = {
            id: authUser.id,
            shop_id: authShopId,
            name: authName || `${freshShop.owner_name} (Owner)`,
            role: (authRole as UserRole) || 'Shop Owner',
            email: cleanEmail,
            created_at: authUser.created_at || new Date().toISOString(),
          };
        }
      }

      // 4b. Fallback: Query users table using auth.uid()
      if (!shop && supabase) {
        const { data: dbUserData, error: dbUserErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!dbUserErr && dbUserData?.shop_id) {
          const freshShop = await db.getShop(dbUserData.shop_id);
          if (freshShop) {
            user = dbUserData as User;
            shop = freshShop;
          }
        }
      }

      // 4c. Fallback: Email lookup in shops table
      if (!shop || !user) {
        const match = await db.getShopByEmail(cleanEmail);
        if (match) {
          user = match.user;
          shop = match.shop;
          // Override user ID with the real auth ID
          if (user) user.id = authUser.id;
        }
      }

      if (!shop || !user) {
        setErrorMsg(`❌ Account Not Found: The shop account for "${cleanEmail}" does not exist in database. Please request account creation from Super Admin.`);
        setLoading(false);
        return;
      }

      if (shop.is_active === false) {
        setErrorMsg('🚨 Account Suspended: Your Jeweler ERP shop access has been deactivated by Platform Super Admin. Please contact support.');
        setLoading(false);
        return;
      }

      // Ensure role from auth metadata is used (not hardcoded)
      if (authRole && (authRole as string) !== 'Super Admin') {
        user.role = authRole;
      }

      setSessionUser({ user, shop });
      await logAuditEvent(shop.id, user.id, user.name, 'LOGIN', 'users', user.id);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/80 via-slate-50 to-amber-100/60 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Animated Floating Ambient Background Lights */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 30, 0],
          y: [0, -30, 0]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-gradient-to-tr from-amber-300/30 to-amber-500/20 rounded-full blur-3xl pointer-events-none"
      />

      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -20, 0],
          y: [0, 40, 0]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -bottom-20 -right-20 w-[550px] h-[550px] bg-gradient-to-bl from-amber-400/20 via-amber-200/30 to-slate-200/40 rounded-full blur-3xl pointer-events-none"
      />

      {/* Floating Animated Golden Orbs */}
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 right-1/4 hidden lg:flex p-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-amber-200/60 text-amber-600"
      >
        <Sparkles className="w-6 h-6" />
      </motion.div>

      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-24 left-1/4 hidden lg:flex p-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-amber-200/60 text-amber-600"
      >
        <Coins className="w-6 h-6" />
      </motion.div>

      {/* Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10"
      >
        <motion.div
          whileHover={{ scale: 1.05, rotate: 3 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 flex items-center justify-center font-bold text-slate-950 shadow-xl shadow-amber-500/20 mb-4 cursor-pointer"
        >
          <Coins className="w-9 h-9" />
        </motion.div>

        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">SuvarnaLoan ERP</h2>
        <p className="mt-1 text-xs font-bold text-amber-800 tracking-wide flex items-center justify-center gap-1">
          <Building2 className="w-3.5 h-3.5" />
          <span>Gold Loan Enterprise Software • Humble Goats SaaS</span>
        </p>
      </motion.div>

      {/* Main Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4"
      >
        <div className="bg-white/90 backdrop-blur-xl border border-amber-200/80 rounded-3xl p-8 shadow-2xl shadow-amber-950/5 relative overflow-hidden">
          {/* Top Decorative Gold Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

          {/* Error Alert */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>

                {!activationSent ? (
                  <button
                    type="button"
                    onClick={handleRequestActivation}
                    className="mt-1 px-3 py-1.5 bg-rose-600 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 hover:bg-rose-700 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Account Activation Request to Super Admin</span>
                  </button>
                ) : (
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Activation Request Dispatched to Super Admin!</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Work Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Account Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-amber-600 transition-colors rounded-xl focus:outline-none"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>



          {/* Footer Security Badge */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Protected by Supabase RLS & 256-bit SSL Encryption</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
