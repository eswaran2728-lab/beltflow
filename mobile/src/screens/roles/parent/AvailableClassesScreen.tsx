import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { MapPin, DollarSign, Clock, Users } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { StatusBadge } from '../../../components/Badges';
import { LoadingState, EmptyState } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import { apiClient } from '../../../services/apiClient';

export interface AvailableClassCard {
  id: string;
  organizationId: string;
  persatuanName: string;
  name: string;
  schedule: string;
  location: string;
  venueDetails?: string;
  ageEligibility?: string;
  trainingLevel?: string;
  programType?: string;
  capacity: number;
  enrollmentAvailability: 'OPEN' | 'WAITLIST' | 'CLOSED';
  monthlyFee: number;
  description?: string;
  contactChannel?: string;
}

export interface AvailableClassesScreenProps {
  user: AuthUser;
  navigation?: any;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const AvailableClassesScreen: React.FC<AvailableClassesScreenProps> = ({
  user,
  navigation,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<AvailableClassCard[]>([]);

  const fetchAvailableClasses = useCallback(async () => {
    try {
      const orgId = user.organizationId;
      if (!orgId) {
        setClasses([]);
        return;
      }
      const res: any = await apiClient.get(`/persatuans/${orgId}/available-classes`);
      setClasses(res?.classes || []);
    } catch (err) {
      console.error('[AvailableClassesScreen fetch error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const orgId = user.organizationId;
        if (!orgId) {
          if (!isCancelled) {
            setClasses([]);
          }
          return;
        }
        const res: any = await apiClient.get(`/persatuans/${orgId}/available-classes`);
        if (!isCancelled) {
          setClasses(res?.classes || []);
        }
      } catch (err) {
        console.error('[AvailableClassesScreen load error]', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  if (loading && classes.length === 0) {
    return (
      <ScreenContainer scrollable testID="available-classes-screen">
        <ScreenHeader
          title="Available Classes"
          subtitle="Explore approved martial arts classes"
          onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
        />
        <LoadingState message="Finding available classes..." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="available-classes-screen">
      <ScreenHeader
        title="Available Classes"
        subtitle="Explore approved martial arts classes"
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAvailableClasses(); }} />}
      >
        {classes.length === 0 ? (
          <EmptyState
            title="No Classes Available"
            description="No approved classes are currently accepting applications in this Persatuan."
            testID="empty-available-classes"
          />
        ) : (
          classes.map((cls) => (
            <Card key={cls.id} variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {cls.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600', marginTop: 2 }]}>
                    {cls.persatuanName}
                  </Text>
                </View>
                <StatusBadge
                  status={cls.enrollmentAvailability === 'OPEN' ? 'ACTIVE' : 'WARNING'}
                  label={cls.enrollmentAvailability}
                  variant={cls.enrollmentAvailability === 'OPEN' ? 'success' : 'warning'}
                />
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Clock size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    {cls.schedule}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <MapPin size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                    {cls.location} {cls.venueDetails ? `— ${cls.venueDetails}` : ''}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <DollarSign size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                    RM {cls.monthlyFee.toFixed(2)} / month
                  </Text>
                </View>

                {cls.ageEligibility || cls.trainingLevel ? (
                  <View style={styles.detailRow}>
                    <Users size={iconSize.sm} color={colors.textSecondary} />
                    <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.xs }]}>
                      Eligibility: {cls.ageEligibility || 'All ages'} | {cls.trainingLevel || 'All levels'}
                    </Text>
                  </View>
                ) : null}

                {cls.description ? (
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                    {cls.description}
                  </Text>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailsGrid: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
