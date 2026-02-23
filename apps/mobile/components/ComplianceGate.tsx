import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/ui';
import { colors, radius, spacing } from '../src/theme';
import { useAuth } from '../src/context/auth';
import { acceptTerms, getComplianceStatus } from '../src/lib/api/media';

const TERMS_VERSION = '2026-02-22-appreview-v1';

export function ComplianceGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(false);

  const userId = useMemo(() => user?.sub || null, [user?.sub]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) {
        setNeedsAcceptance(false);
        setAccountBlocked(false);
        return;
      }

      setIsLoading(true);
      try {
        const status = await getComplianceStatus(userId);
        if (cancelled) return;
        const blocked = !!status.isRemoved || !!status.isSuspended || !!status.accountDeletedAt;
        setAccountBlocked(blocked);
        setNeedsAcceptance(!blocked && !status.acceptedTerms);
      } catch (error) {
        // If status endpoint fails, keep app usable but do not block.
        console.warn('[ComplianceGate] Status check failed:', error);
        if (!cancelled) {
          setNeedsAcceptance(false);
          setAccountBlocked(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleAccept = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await acceptTerms(userId, TERMS_VERSION);
      setNeedsAcceptance(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout({ logoutParams: { returnTo: 'https://www.usechomp.com/demo/' } });
  };

  return (
    <>
      {children}
      <Modal visible={!!userId && (needsAcceptance || accountBlocked)} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : accountBlocked ? (
              <>
                <Text variant="title">Account unavailable</Text>
                <Text variant="bodySmall" color={colors.muted} style={styles.body}>
                  This account is currently unavailable due to a safety review. Contact support if you think this is a mistake.
                </Text>
                <Pressable style={styles.primaryButton} onPress={handleLogout}>
                  <Text variant="subtitle" color={colors.bg}>Log Out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text variant="title">Community Terms</Text>
                <ScrollView style={styles.termsScroll}>
                  <Text variant="bodySmall" style={styles.body}>
                    By continuing, you agree to the Chomp Terms of Use and EULA. Chomp has zero tolerance for objectionable
                    content, harassment, hate, abuse, sexual exploitation, or violence. Users who post or promote abusive content
                    may be reported, blocked, removed from feeds, and permanently ejected from the app.
                  </Text>
                  <Text variant="bodySmall" color={colors.muted} style={styles.body}>
                    You can report content directly in the app. Our moderation team reviews reports and takes action within 24 hours.
                  </Text>
                </ScrollView>
                <Pressable style={styles.primaryButton} onPress={handleAccept}>
                  <Text variant="subtitle" color={colors.bg}>I Agree and Continue</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={handleLogout}>
                  <Text variant="bodySmall" color={colors.text}>Not Now</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  termsScroll: {
    maxHeight: 220,
  },
  body: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
