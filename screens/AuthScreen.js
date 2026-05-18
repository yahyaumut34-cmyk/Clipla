/**
 * AuthScreen — Giriş / Kayıt ekranı
 * Supabase email+şifre ve GitHub OAuth destekler.
 */

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { C } from '../shared/theme';
import { signIn, signUp, signInWithGitHub, resetPassword } from '../shared/supabase';

const TABS = ['Giriş Yap', 'Kayıt Ol'];

export function AuthScreen({ onAuth }) {
  const [tab, setTab]           = useState(0); // 0=giriş, 1=kayıt
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [ghLoading, setGhLoading] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  function clearMessages() { setError(''); setSuccess(''); }

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Email ve şifre boş olamaz.');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const fn = tab === 0 ? signIn : signUp;
      const { data, error: err } = await fn(email.trim(), password);
      if (err) {
        setError(translateError(err.message));
        return;
      }
      if (tab === 1 && !data?.session) {
        // Email doğrulama gönderildi
        setSuccess('Kayıt başarılı! Email adresine doğrulama bağlantısı gönderildi.');
        return;
      }
      if (data?.session) onAuth?.(data.session);
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHub() {
    clearMessages();
    setGhLoading(true);
    try {
      const { data, error: err } = await signInWithGitHub();
      if (err) {
        setError(translateError(err.message));
        return;
      }
      if (data?.session) onAuth?.(data.session);
    } finally {
      setGhLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Şifre sıfırlamak için önce email adresini gir.');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const { error: err } = await resetPassword(email.trim());
      if (err) { setError(translateError(err.message)); return; }
      setSuccess('Şifre sıfırlama bağlantısı email adresine gönderildi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Text style={s.logo}>Clipla-Y</Text>
        <Text style={s.sub}>AI Destekli Video Düzenleme</Text>

        {/* Tab bar */}
        <View style={s.tabs}>
          {TABS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[s.tab, tab === i && s.tabActive]}
              onPress={() => { setTab(i); clearMessages(); }}
            >
              <Text style={[s.tabTxt, tab === i && s.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={t => { setEmail(t); clearMessages(); }}
            placeholder="ornek@email.com"
            placeholderTextColor={C.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={s.label}>Şifre</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={t => { setPassword(t); clearMessages(); }}
            placeholder={tab === 1 ? 'En az 6 karakter' : '••••••••'}
            placeholderTextColor={C.muted}
            secureTextEntry
          />

          {/* Hata / başarı mesajı */}
          {!!error   && <Text style={s.msgError}>{error}</Text>}
          {!!success && <Text style={s.msgSuccess}>{success}</Text>}

          {/* Ana buton */}
          <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small"/>
              : <Text style={s.btnTxt}>{TABS[tab]}</Text>
            }
          </TouchableOpacity>

          {/* Şifremi unuttum (sadece giriş sekmesinde) */}
          {tab === 0 && (
            <TouchableOpacity onPress={handleForgotPassword} style={s.forgotBtn}>
              <Text style={s.forgotTxt}>Şifremi unuttum</Text>
            </TouchableOpacity>
          )}

          {/* Ayraç */}
          <View style={s.divider}>
            <View style={s.dividerLine}/>
            <Text style={s.dividerTxt}>veya</Text>
            <View style={s.dividerLine}/>
          </View>

          {/* GitHub butonu */}
          <TouchableOpacity style={s.ghBtn} onPress={handleGitHub} disabled={ghLoading}>
            {ghLoading
              ? <ActivityIndicator color={C.txt} size="small"/>
              : <>
                  <Text style={s.ghIcon}>⬡</Text>
                  <Text style={s.ghTxt}>GitHub ile Devam Et</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>
          Devam ederek{' '}
          <Text style={s.footerLink}>Kullanım Koşulları</Text>
          {' '}ve{' '}
          <Text style={s.footerLink}>Gizlilik Politikası</Text>
          'nı kabul etmiş olursunuz.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Supabase hata mesajlarını Türkçeye çevir
function translateError(msg = '') {
  if (msg.includes('Invalid login credentials'))  return 'Email veya şifre hatalı.';
  if (msg.includes('Email not confirmed'))        return 'Email adresini henüz doğrulamadın. Gelen kutunu kontrol et.';
  if (msg.includes('User already registered'))   return 'Bu email zaten kayıtlı. Giriş yapmayı dene.';
  if (msg.includes('Password should be'))        return 'Şifre en az 6 karakter olmalı.';
  if (msg.includes('Unable to validate'))        return 'Geçersiz email adresi.';
  if (msg.includes('iptal edildi'))              return msg;
  return msg;
}

const s = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },

  logo:         { fontSize: 36, color: C.txt, fontStyle: 'italic', textAlign: 'center', marginBottom: 4 },
  sub:          { fontSize: 13, color: C.dim, textAlign: 'center', marginBottom: 32 },

  tabs:         { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, padding: 3, marginBottom: 24 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive:    { backgroundColor: C.accent },
  tabTxt:       { color: C.dim, fontSize: 14, fontWeight: '500' },
  tabTxtActive: { color: '#fff', fontWeight: '700' },

  form:         { gap: 4 },
  label:        { color: C.dim, fontSize: 12, marginBottom: 4, marginTop: 12 },
  input:        {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: C.txt, fontSize: 15,
  },

  msgError:     { color: '#ff6b6b', fontSize: 13, marginTop: 8 },
  msgSuccess:   { color: C.green,   fontSize: 13, marginTop: 8 },

  btn:          {
    backgroundColor: C.accent, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  btnTxt:       { color: '#fff', fontSize: 15, fontWeight: '700' },

  forgotBtn:    { alignItems: 'center', marginTop: 12 },
  forgotTxt:    { color: C.dim, fontSize: 13 },

  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  dividerTxt:   { color: C.muted, fontSize: 13 },

  ghBtn:        {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingVertical: 13,
  },
  ghIcon:       { color: C.txt, fontSize: 18 },
  ghTxt:        { color: C.txt, fontSize: 15, fontWeight: '500' },

  footer:       { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 28, lineHeight: 17 },
  footerLink:   { color: C.dim },
});
