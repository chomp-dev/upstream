/**
 * Create Tab - Upload video/images + attach restaurant
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { mediaApi, searchApi } from '../../src/lib/api';
import type { Restaurant } from '../../src/lib/api/types';

export default function CreateScreen() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Restaurant attachment
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  
  const router = useRouter();

  const loadNearbyRestaurants = useCallback(async () => {
    try {
      setLoadingRestaurants(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location access is required to find nearby restaurants');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await searchApi.searchNearby(
        location.coords.latitude,
        location.coords.longitude,
        1600 // 1 mile radius
      );

      setNearbyRestaurants(response.restaurants);
    } catch (error) {
      console.error('Error loading restaurants:', error);
      Alert.alert('Error', 'Could not load nearby restaurants');
    } finally {
      setLoadingRestaurants(false);
    }
  }, []);

  useEffect(() => {
    if (showRestaurantPicker && nearbyRestaurants.length === 0) {
      loadNearbyRestaurants();
    }
  }, [showRestaurantPicker, loadNearbyRestaurants]);

  const uploadVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60,
      });

      if (result.canceled) return;

      setUploading(true);
      setUploadProgress(0);
      setUploadStatus('Getting upload URL...');

      const uploadResponse = await mediaApi.requestVideoUpload(
        selectedRestaurant?.google_place_id
      );

      if (!uploadResponse.uploadUrl || !uploadResponse.videoId) {
        throw new Error('Invalid response from backend');
      }

      const fileUri = result.assets[0].uri;
      const fileSize = result.assets[0].fileSize || 0;
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
      const mimeType = result.assets[0].mimeType || 'video/mp4';

      setUploadStatus(`Uploading ${fileSizeMB} MB...`);
      setUploadProgress(0.05);

      const uploadStartTime = Date.now();

      const uploadTask = FileSystemLegacy.createUploadTask(
        uploadResponse.uploadUrl,
        fileUri,
        {
          uploadType: FileSystemLegacy.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: mimeType,
          parameters: {},
          headers: {},
        },
        (progressData) => {
          const progress = progressData.totalBytesSent / progressData.totalBytesExpectedToSend;
          const uploadedMB = (progressData.totalBytesSent / 1024 / 1024).toFixed(2);
          const totalMB = (progressData.totalBytesExpectedToSend / 1024 / 1024).toFixed(2);
          const elapsed = (Date.now() - uploadStartTime) / 1000;
          const speed = elapsed > 0 ? progressData.totalBytesSent / elapsed : 0;
          const speedMBps = (speed / 1024 / 1024).toFixed(2);
          const remaining = progressData.totalBytesExpectedToSend - progressData.totalBytesSent;
          const eta = speed > 0 ? Math.round(remaining / speed) : 0;

          setUploadProgress(progress * 0.95);
          setUploadStatus(
            `Uploading... ${Math.round(progress * 100)}% (${uploadedMB}/${totalMB} MB, ${speedMBps} MB/s, ~${eta}s left)`
          );
        }
      );

      const uploadResult = await uploadTask.uploadAsync();

      if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult?.status}`);
      }

      setUploadProgress(1.0);
      setUploadStatus('Upload complete!');
      setUploading(false);
      setSelectedRestaurant(null);

      Alert.alert(
        'Success',
        'Video uploaded! It will appear in your feed once processing is complete.',
        [{ text: 'View Feed', onPress: () => router.replace('/') }]
      );
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error?.message || 'Failed to upload video');
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const uploadImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled || !result.assets) return;

      if (result.assets.length < 1 || result.assets.length > 10) {
        Alert.alert('Error', 'Please select between 1 and 10 images');
        return;
      }

      setUploading(true);
      setUploadStatus('Uploading images...');

      const imageUris = result.assets.map((asset) => asset.uri);
      await mediaApi.uploadImages(imageUris, selectedRestaurant?.google_place_id);

      setUploading(false);
      setSelectedRestaurant(null);

      Alert.alert('Success', 'Images uploaded!', [
        { text: 'View Feed', onPress: () => router.replace('/') },
      ]);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload images');
      setUploading(false);
    }
  };

  const renderRestaurantItem = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity
      style={styles.restaurantItem}
      onPress={() => {
        setSelectedRestaurant(item);
        setShowRestaurantPicker(false);
      }}
    >
      <View style={[styles.ratingDot, { backgroundColor: ratingColor(item.rating) }]} />
      <View style={styles.restaurantInfo}>
        <Text variant="body" numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.restaurantMeta}>
          {item.rating && (
            <Text variant="caption" color={ratingColor(item.rating)}>
              ★ {item.rating.toFixed(1)}
            </Text>
          )}
          {item.price_level !== null && (
            <Text variant="caption" color={colors.coral}>
              {priceDisplay(item.price_level)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text variant="heading" style={styles.title}>
          Create
        </Text>
        <Text variant="bodySmall" color={colors.muted} style={styles.subtitle}>
          Share your food discoveries
        </Text>

        {/* Restaurant attachment */}
        <View style={styles.section}>
          <Text variant="label" style={styles.sectionLabel}>
            Attach Restaurant (optional)
          </Text>
          <TouchableOpacity
            style={styles.restaurantSelector}
            onPress={() => setShowRestaurantPicker(true)}
          >
            {selectedRestaurant ? (
              <View style={styles.selectedRestaurant}>
                <View
                  style={[styles.ratingDot, { backgroundColor: ratingColor(selectedRestaurant.rating) }]}
                />
                <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {selectedRestaurant.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedRestaurant(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.coral} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="location-outline" size={16} color={colors.muted} />
                <Text variant="bodySmall" color={colors.muted}>
                  Tap to select a nearby restaurant
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Upload buttons */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={uploadVideo}
            disabled={uploading}
          >
            <Ionicons name="videocam" size={36} color={colors.bg} style={{ marginBottom: spacing.sm }} />
            <Text variant="subtitle" color={colors.bg}>
              Upload Video
            </Text>
            <Text variant="caption" color={colors.bg} style={{ opacity: 0.7 }}>
              Up to 60 seconds
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, styles.uploadButtonSecondary, uploading && styles.uploadButtonDisabled]}
            onPress={uploadImages}
            disabled={uploading}
          >
            <Ionicons name="images-outline" size={36} color={colors.text} style={{ marginBottom: spacing.sm }} />
            <Text variant="subtitle">Upload Images</Text>
            <Text variant="caption" color={colors.muted}>
              1-10 photos
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Upload Progress Modal */}
      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="title" style={styles.modalTitle}>
              Uploading
            </Text>
            <Text variant="bodySmall" color={colors.muted} center>
              {uploadStatus}
            </Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${uploadProgress * 100}%` }]} />
            </View>
            <Text variant="subtitle" color={colors.primary}>
              {Math.round(uploadProgress * 100)}%
            </Text>
          </View>
        </View>
      </Modal>

      {/* Restaurant Picker Modal */}
      <Modal
        visible={showRestaurantPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text variant="title">Select Restaurant</Text>
            <TouchableOpacity onPress={() => setShowRestaurantPicker(false)}>
              <Text variant="body" color={colors.blue}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          {loadingRestaurants ? (
            <View style={styles.pickerLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text variant="bodySmall" color={colors.muted} style={{ marginTop: spacing.md }}>
                Finding nearby restaurants...
              </Text>
            </View>
          ) : (
            <FlatList
              data={nearbyRestaurants}
              keyExtractor={(item) => item.id}
              renderItem={renderRestaurantItem}
              contentContainerStyle={styles.pickerList}
              ListEmptyComponent={
                <View style={styles.pickerLoading}>
                  <Text variant="body" center>
                    No restaurants found nearby
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  restaurantSelector: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedRestaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  uploadButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    marginBottom: spacing.sm,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    marginVertical: spacing.lg,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerList: {
    padding: spacing.lg,
  },
  restaurantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
});
