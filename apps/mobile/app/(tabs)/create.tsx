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
  TextInput,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { mediaApi, searchApi } from '../../src/lib/api';
import type { Restaurant } from '../../src/lib/api/types';

import { useAuth } from '../../src/context/auth';

export default function CreateScreen() {
  const { user, login, supabase } = useAuth();

  useEffect(() => {
    console.log('[CreateScreen] Mounted - Version: Fix-Image-Upload-V2');
  }, []);

  if (!user) {
    return (
      <Screen>
        <View style={styles.authContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.primary} />
          <Text variant="title" center style={{ marginTop: spacing.lg }}>
            Sign in to Post
          </Text>
          <Text variant="body" color={colors.muted} center style={{ marginVertical: spacing.md }}>
            You need an account to share your food discoveries.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => login()}>
            <Text variant="subtitle" color={colors.bg}>Sign In / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Restaurant attachment
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.restaurant) {
      try {
        const restaurantData = JSON.parse(params.restaurant as string);
        setSelectedRestaurant(restaurantData);
        console.log('[CreateScreen] Pre-selected restaurant:', restaurantData.name);
      } catch (e) {
        console.error('Failed to parse restaurant param:', e);
      }
    }
  }, [params.restaurant]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 2) {
      try {
        setSearching(true);
        // Use current location bias if available
        let lat, lng;
        try {
          const loc = await Location.getCurrentPositionAsync();
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch { }

        const response = await searchApi.searchRestaurants(query, lat, lng);
        setSearchResults(response.restaurants);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  }, []);

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

  // Metadata state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  interface MediaItem {
    type: 'video' | 'image' | 'tiktok';
    uri: string;
    fileSize?: number;
    mimeType?: string;
  }

  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [showTikTokInput, setShowTikTokInput] = useState(false);
  const [tempTikTokUrl, setTempTikTokUrl] = useState('');

  const resetForm = () => {
    setSelectedMedia([]);
    setSelectedRestaurant(null);
    setTitle('');
    setDescription('');
    setTags('');
    setUploadProgress(0);
    setUploadStatus('');
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access to upload');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets) return;

      const asset = result.assets[0];
      const fileSize = asset.fileSize || 0;
      const fileSizeMB = fileSize / 1024 / 1024;

      if (fileSizeMB > 100) {
        Alert.alert('File too large', 'Please upload videos under 100MB');
        return;
      }

      setSelectedMedia([{
        type: 'video',
        uri: asset.uri,
        fileSize: fileSize,
        mimeType: asset.mimeType
      }]);

    } catch (error: any) {
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
      });

      if (result.canceled || !result.assets) return;

      const newMedia = result.assets.map(asset => ({
        type: 'image' as const,
        uri: asset.uri,
      }));
      setSelectedMedia(newMedia);

    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to pick images');
    }
  };

  const handleTikTokSelect = () => {
    if (!tempTikTokUrl.trim() || !tempTikTokUrl.includes('tiktok.com')) {
      Alert.alert('Invalid URL', 'Please enter a valid TikTok URL');
      return;
    }

    setSelectedMedia([{
      type: 'tiktok',
      uri: tempTikTokUrl.trim(),
    }]);
    setShowTikTokInput(false);
    setTempTikTokUrl('');
  };

  const handleUpload = async () => {
    if (selectedMedia.length === 0) return;
    if (!selectedRestaurant) {
      Alert.alert('Required', 'Please attach a restaurant to your post.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Required', 'Please add a title for your post.');
      return;
    }

    try {
      setUploading(true);
      setUploadStatus('Preparing upload...');
      setUploadProgress(0);

      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      const mediaType = selectedMedia[0].type;

      if (mediaType === 'tiktok') {
        // --- TIKTOK EMBED ---
        setUploadStatus('Saving TikTok...');
        const response = await mediaApi.addTikTokEmbed(selectedMedia[0].uri, selectedRestaurant.google_place_id);

        if (!response.success) throw new Error('Failed to add TikTok embed');
        setUploadProgress(1);

      } else if (mediaType === 'video') {
        // --- VIDEO UPLOAD (Single) ---
        const media = selectedMedia[0];
        let fileSize = media.fileSize || 0;

        // On native, verify file exists
        if (Platform.OS !== 'web') {
          const fileInfo = await FileSystem.getInfoAsync(media.uri);
          if (!fileInfo.exists) throw new Error('File does not exist');
          fileSize = fileInfo.size || fileSize;
        }

        // 1. Get Upload URL
        setUploadStatus('Getting secure upload URL...');
        const initResponse = await fetch(`${mediaApi.BASE_URL}/api/upload/video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_place_id: selectedRestaurant.google_place_id,
            title: title.trim(),
            description: description.trim(),
            tags: tagArray,
            user_id: user?.sub
          }),
        });

        if (!initResponse.ok) throw new Error('Failed to init upload');
        const { uploadUrl } = await initResponse.json();

        // 2. Upload to Cloudflare
        setUploadStatus('Uploading video...');

        // Prepare file/blob
        const formData = new FormData();

        if (Platform.OS === 'web') {
          const vidRes = await fetch(media.uri);
          const blob = await vidRes.blob();
          formData.append('file', blob, 'video.mp4');
        } else {
          formData.append('file', {
            uri: media.uri,
            name: 'video.mp4',
            type: 'video/mp4',
          } as any);
        }

        const xhr = new XMLHttpRequest();
        await new Promise((resolve, reject) => {
          xhr.open('POST', uploadUrl);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadProgress(event.loaded / event.total);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
            else reject(new Error(`Upload failed: ${xhr.status}`));
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(formData);
        });

        setUploadStatus('Processing...');
        setUploadProgress(1);

      } else {
        // --- MULTIPLE IMAGE UPLOAD ---
        const imageUrls: string[] = [];
        const totalImages = selectedMedia.length;

        for (let i = 0; i < totalImages; i++) {
          const media = selectedMedia[i];
          setUploadStatus(`Uploading image ${i + 1} of ${totalImages}...`);
          setUploadProgress(i / totalImages);

          // 1. Get Upload URL and Delivery URL
          // We need to use valid delivery URLs for the frontend insert
          const { uploadURL, deliveryUrl } = await mediaApi.getImageUploadUrl();

          // 2. Upload to Cloudflare (Reuse existing helper for consistency)
          await mediaApi.uploadImageToCloudflare(uploadURL, media.uri);

          imageUrls.push(deliveryUrl);
        }

        setUploadProgress(1);
        setUploadStatus('Finalizing post...');

        console.log('[Create] Inserting image post to Supabase:', imageUrls);

        // 3. Create Post in Supabase directly (RLS protected)
        const { error } = await supabase
          .from('image_posts')
          .insert({
            images: imageUrls,
            google_place_id: selectedRestaurant.google_place_id,
            title: title.trim(),
            description: description.trim(),
            tags: tagArray, // Assuming backend accepts text array
            user_id: user?.sub
          })
          .select();

        if (error) {
          console.error('[Create] Supabase insert failed:', error);
          throw new Error(error.message || 'Failed to create post record');
        }

      }

      Alert.alert('Success', 'Upload complete!');
      resetForm();
      router.push('/');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Upload failed');
    } finally {
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

        {/* Media Selection Section */}
        <View style={styles.section}>
          <Text variant="label" style={styles.sectionLabel}>Select Media <Text color={colors.coral}>*</Text></Text>

          {selectedMedia.length === 0 ? (
            <View style={{ gap: spacing.md }}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickVideo}
                disabled={uploading}
              >
                <Ionicons name="videocam" size={36} color={colors.bg} style={{ marginBottom: spacing.sm }} />
                <Text variant="subtitle" color={colors.bg}>Pick Video</Text>
                <Text variant="caption" color={colors.bg} style={{ opacity: 0.7 }}>Up to 60 seconds</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <TouchableOpacity
                  style={[styles.uploadButton, styles.uploadButtonSecondary, { flex: 1 }]}
                  onPress={pickImages}
                  disabled={uploading}
                >
                  <Ionicons name="images-outline" size={32} color={colors.text} style={{ marginBottom: spacing.sm }} />
                  <Text variant="subtitle">Images</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadButton, styles.uploadButtonSecondary, { flex: 1, backgroundColor: '#000', borderColor: '#000' }]}
                  onPress={() => setShowTikTokInput(true)}
                  disabled={uploading}
                >
                  <Ionicons name="logo-tiktok" size={32} color="#fff" style={{ marginBottom: spacing.sm }} />
                  <Text variant="subtitle" color="#fff">TikTok</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {selectedMedia.map((media, index) => (
                    <View key={index} style={styles.mediaPreview}>
                      {media.type === 'video' ? (
                        <View style={{ alignItems: 'center' }}>
                          <Ionicons name="videocam" size={48} color={colors.muted} />
                          <Text variant="caption">{media.mimeType || 'Video'}</Text>
                        </View>
                      ) : media.type === 'tiktok' ? (
                        <View style={{ alignItems: 'center', padding: spacing.md }}>
                          <Ionicons name="logo-tiktok" size={48} color={colors.text} />
                          <Text variant="caption" numberOfLines={1} style={{ marginTop: spacing.sm, maxWidth: '100%' }}>
                            {media.uri}
                          </Text>
                        </View>
                      ) : (
                        <Image source={{ uri: media.uri }} style={{ width: 200, height: 200, borderRadius: radius.lg }} resizeMode="cover" />
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.changeMediaButton}
                onPress={() => setSelectedMedia([])}
              >
                <Text variant="caption" color={colors.coral}>Clear Selection</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* TikTok Input Modal */}
        <Modal visible={showTikTokInput} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text variant="title">Add TikTok Link</Text>
              <TextInput
                style={[styles.input, { width: '100%', marginTop: spacing.md }]}
                placeholder="https://www.tiktok.com/..."
                placeholderTextColor={colors.muted}
                value={tempTikTokUrl}
                onChangeText={setTempTikTokUrl}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <TouchableOpacity onPress={() => setShowTikTokInput(false)} style={{ padding: spacing.md }}>
                  <Text variant="body" color={colors.muted}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleTikTokSelect}
                  style={{ backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md }}
                >
                  <Text variant="body" color={colors.bg}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Form Container - ALWAYS VISIBLE */}
        <View style={styles.formContainer}>
          {/* Restaurant Picker */}
          <View style={styles.section}>
            <Text variant="label" style={styles.sectionLabel}>
              Restaurant <Text color={colors.coral}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.restaurantSelector}
              onPress={() => setShowRestaurantPicker(true)}
            >
              {selectedRestaurant ? (
                <View style={styles.selectedRestaurant}>
                  <View style={[styles.ratingDot, { backgroundColor: ratingColor(selectedRestaurant.rating) }]} />
                  <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{selectedRestaurant.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedRestaurant(null)}>
                    <Ionicons name="close-circle" size={20} color={colors.coral} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="location-outline" size={16} color={colors.muted} />
                  <Text variant="bodySmall" color={colors.muted}>Select Restaurant</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Metadata Inputs */}
          <View style={styles.section}>
            <Text variant="label" style={styles.sectionLabel}>Title <Text color={colors.coral}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Best Sushi in Town!"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.section}>
            <Text variant="label" style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us about your experience..."
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
            />
          </View>

          <View style={styles.section}>
            <Text variant="label" style={styles.sectionLabel}>Tags</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. sushi, spicy, date-night"
              placeholderTextColor={colors.muted}
              value={tags}
              onChangeText={setTags}
            />
            <Text variant="caption" color={colors.muted} style={{ marginTop: 4 }}>Comma separated</Text>
          </View>

          {/* Post Button */}
          <TouchableOpacity
            style={[
              styles.uploadButton,
              (uploading || selectedMedia.length === 0 || !selectedRestaurant || !title.trim()) && styles.uploadButtonDisabled
            ]}
            onPress={handleUpload}
            disabled={uploading || selectedMedia.length === 0 || !selectedRestaurant || !title.trim()}
          >
            {uploading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text variant="subtitle" color={colors.bg}>Post Review</Text>
            )}
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
          <View style={styles.pickerHeaderColumn}>
            <View style={styles.pickerHeaderRow}>
              <Text variant="title">Select Restaurant</Text>
              <TouchableOpacity onPress={() => setShowRestaurantPicker(false)}>
                <Text variant="body" color={colors.blue}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a restaurant..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {(loadingRestaurants || searching) ? (
            <View style={styles.pickerLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text variant="bodySmall" color={colors.muted} style={{ marginTop: spacing.md }}>
                {searching ? 'Searching...' : 'Finding nearby restaurants...'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchQuery.length > 2 ? searchResults : nearbyRestaurants}
              keyExtractor={(item) => item.id}
              renderItem={renderRestaurantItem}
              contentContainerStyle={styles.pickerList}
              ListEmptyComponent={
                <View style={styles.pickerLoading}>
                  <Text variant="body" center>
                    {searchQuery.length > 0 ? 'No results found' : 'No restaurants found nearby'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </Screen >
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
  pickerHeaderColumn: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
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
    marginLeft: spacing.sm,
  },
  restaurantMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  formContainer: {
    gap: spacing.md,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  mediaPreview: {
    height: 200,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
  changeMediaButton: {
    padding: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
});
