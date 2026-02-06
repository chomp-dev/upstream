/**
 * Create Tab - Upload video/images + attach restaurant
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
            <Text variant="subtitle" color={'#000'}>Sign In / Sign Up</Text>
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
    // Handle rich object param (from some flows)
    if (params.restaurant) {
      try {
        const restaurantData = JSON.parse(params.restaurant as string);
        setSelectedRestaurant(restaurantData);
        if (__DEV__) console.log('[CreateScreen] Pre-selected restaurant (obj):', restaurantData.name);
      } catch (e) {
        if (__DEV__) console.error('Failed to parse restaurant param:', e);
      }
    }
    // Handle flattened params (from Restaurant Detail page)
    else if (params.google_place_id && params.restaurant_name) {
      setSelectedRestaurant({
        google_place_id: params.google_place_id as string,
        name: params.restaurant_name as string,
        // Fill other fields with defaults if needed, or fetched later
        rating: 0,
        price_level: null,
        vicinity: '',
        lat: 0,
        lng: 0
      } as unknown as Restaurant);
      if (__DEV__) console.log('[CreateScreen] Pre-selected restaurant (params):', params.restaurant_name);
    }
  }, [params.restaurant, params.google_place_id, params.restaurant_name]);

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

      // UNIVERSAL DATA: Try to get from MapStore cache first
      try {
        const { mapStore } = require('../../src/lib/mapStore');
        const cachedMap = await mapStore.getRestaurants();
        if (cachedMap && cachedMap.restaurants && cachedMap.restaurants.length > 0) {
          console.log('[Create] Loaded nearby from MapStore cache:', cachedMap.restaurants.length);
          setNearbyRestaurants(cachedMap.restaurants);
          setLoadingRestaurants(false);

          // If data is fresh enough (e.g. < 5 mins), return early?
          // For now, let's aggressively background refresh if we suspect staleness, 
          // but showing cache immediately is the goal.
          // We will just use cache for now to satisfy "Universal Data".
          const now = Date.now();
          if (now - cachedMap.lastFetchedAt < 1000 * 60 * 10) { // 10 min trust
            return;
          }
        }
      } catch (e) {
        console.warn('[Create] Failed to read mapStore:', e);
      }

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

  // Stage flow state (1=media, 2=restaurant, 3=description)
  const [currentStage, setCurrentStage] = useState(1);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = Dimensions.get('window');

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
    setUploadProgress(0);
    setUploadStatus('');
    setCurrentStage(1);
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
  };

  // Animate to next stage
  const goToStage = (stage: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: stage > currentStage ? -50 : 50,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStage(stage);
      slideAnim.setValue(stage > currentStage ? 50 : -50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
      ]).start();
    });
  };

  // Auto-advance when media is selected
  useEffect(() => {
    if (selectedMedia.length > 0 && currentStage === 1) {
      // If restaurant is pre-selected, skip to stage 3
      if (selectedRestaurant) {
        goToStage(3);
      } else {
        goToStage(2);
      }
    }
  }, [selectedMedia]);

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

    // Track IDs for navigation
    let savedPendingId: string | null = null;
    let savedImageDataId: string | null = null;

    try {
      setUploading(true);
      setUploadStatus('Preparing upload...');
      setUploadProgress(0);

      const tagArray: string[] = []; // Tags removed from UI
      const mediaType = selectedMedia[0].type;

      if (mediaType === 'tiktok') {
        // --- TIKTOK EMBED ---
        setUploadStatus('Saving TikTok...');
        const response = await mediaApi.addTikTokEmbed(selectedMedia[0].uri, selectedRestaurant.google_place_id, user?.sub);

        if (!response.success) throw new Error('Failed to add TikTok embed');

        // Store TikTok ID for navigation (like video does)
        if (response.embed?.id) {
          savedPendingId = `tiktok-${response.embed.id}`;
        }
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

        // Create pending video item to show in feed while processing
        const pendingId = `pending-${Date.now()}`;
        const { navigationStore } = require('../../src/lib/navigationStore');
        const pendingVideo: any = {
          id: pendingId,
          type: 'video',
          status: 'processing',
          user_id: user?.sub,
          username: user?.user_metadata?.username || user?.name || 'You',
          user_avatar: user?.user_metadata?.avatar_url || user?.picture,
          google_place_id: selectedRestaurant.google_place_id,
          title: title.trim(),
          description: description.trim(),
          created_at: new Date().toISOString(),
          cloudflare_video_id: null,
          playback_url: null,
          thumbnail_url: null,
        };
        navigationStore.set(pendingId, pendingVideo);
        console.log('[Create] Created pending video item:', pendingId);

        // Inject into feed so it appears locally
        const { feedStore } = require('../../src/lib/feedStore');
        const cachedFeed = await feedStore.getFeed();
        const currentFeed = cachedFeed?.feed || [];
        const nearbyPlaceIds = cachedFeed?.nearbyPlaceIds || [];
        const feedMode = cachedFeed?.feedMode || 'nearby';
        // Add pending video at the top of the feed
        await feedStore.setFeed([pendingVideo, ...currentFeed], nearbyPlaceIds, feedMode);
        console.log('[Create] Injected pending video into feed');

        // Store pendingId in component state for navigation
        savedPendingId = pendingId;

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

          try {
            console.log(`[Create] Uploading image ${i + 1}:`, media.uri);

            // 1. Get Upload URL and Delivery URL
            const { uploadURL, deliveryUrl } = await mediaApi.getImageUploadUrl();
            console.log(`[Create] Got upload URL for image ${i + 1}:`, deliveryUrl);

            // 2. Upload to Cloudflare
            await mediaApi.uploadImageToCloudflare(uploadURL, media.uri);
            console.log(`[Create] Successfully uploaded image ${i + 1}`);

            imageUrls.push(deliveryUrl);
          } catch (uploadError) {
            console.error(`[Create] Failed to upload image ${i + 1}:`, uploadError);
            throw new Error(`Failed to upload image ${i + 1}: ${(uploadError as Error).message}`);
          }
        }

        setUploadProgress(1);
        setUploadStatus('Finalizing post...');

        console.log('[Create] Creating image post via backend API:', imageUrls);

        // 3. Create Post via backend API (bypasses RLS for iOS compatibility)
        const postResult = await mediaApi.uploadImages(
          imageUrls,
          selectedRestaurant.google_place_id,
          title.trim(),
          description.trim(),
          tagArray,
          user?.sub
        );

        console.log('[Create] Backend image post created:', postResult);

        // Store image post in navigationStore for feed to display
        if (postResult.post) {
          const imageDataId = `image-${Date.now()}`;
          const { navigationStore } = require('../../src/lib/navigationStore');
          const imagePostItem = {
            ...postResult.post,
            type: 'image',
            username: user?.user_metadata?.username || user?.name || 'You',
            user_avatar: user?.user_metadata?.avatar_url || user?.picture,
          };
          navigationStore.set(imageDataId, imagePostItem);
          console.log('[Create] Stored image post in navigationStore:', imageDataId);

          // Inject into feed so it appears locally
          try {
            const { feedStore } = require('../../src/lib/feedStore');
            const cachedFeed = await feedStore.getFeed();
            const currentFeed = cachedFeed?.feed || [];
            await feedStore.setFeed([imagePostItem, ...currentFeed], [], 'for-you');
            console.log('[Create] Injected image post into feed');

            // Store for navigation (declared in outer scope)
            savedImageDataId = imageDataId;
          } catch (feedError) {
            console.error('[Create] Feed injection failed:', feedError);
            Alert.alert('Feed Error', `Failed to update feed: ${(feedError as Error).message}`);
            // Don't throw - post is saved, just feed display failed
          }
        }
      }

      console.log('[Create] Upload flow complete. Resetting form and navigating home.');
      resetForm();

      // Navigate to feed with the uploaded content
      setTimeout(() => {
        if ((mediaType === 'video' || mediaType === 'tiktok') && savedPendingId) {
          router.push({ pathname: '/', params: { videoDataId: savedPendingId } });
        } else if (mediaType === 'image' && savedImageDataId) {
          router.push({ pathname: '/', params: { videoDataId: savedImageDataId } });
        } else {
          router.push('/');
        }
      }, 100);

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
      {/* Upload Progress Modal */}
      {uploading && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.uploadingOverlay}>
            <View style={styles.uploadingCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text variant="subtitle" center style={{ marginTop: spacing.md }}>
                {uploadStatus}
              </Text>
              <Text variant="body" color={colors.muted} center style={{ marginTop: spacing.sm }}>
                {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
          </View>
        </Modal>
      )}

      <View style={styles.headerContainer}>
        <Text variant="heading" style={styles.title}>New Post</Text>
        <Text variant="caption" color={colors.muted}>Step {currentStage} of 3</Text>
      </View>

      {/* Stage Progress Bar */}
      <View style={styles.stageProgressContainer}>
        <View style={[styles.stageDot, currentStage >= 1 && styles.stageActive]} />
        <View style={[styles.stageLine, currentStage >= 2 && styles.stageActive]} />
        <View style={[styles.stageDot, currentStage >= 2 && styles.stageActive]} />
        <View style={[styles.stageLine, currentStage >= 3 && styles.stageActive]} />
        <View style={[styles.stageDot, currentStage >= 3 && styles.stageActive]} />
      </View>

      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* STAGE 1: MEDIA SELECTION */}
            {currentStage === 1 && (
              <View style={styles.stageContent}>
                <Text variant="title" style={styles.stageTitle}>What are we eating?</Text>
                <Text variant="body" color={colors.muted} style={{ marginBottom: 24 }}>
                  Start by selecting a video or photo.
                </Text>

                {selectedMedia.length === 0 ? (
                  <View style={{ gap: spacing.md }}>
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={pickVideo}
                      disabled={uploading}
                    >
                      <Ionicons name="videocam" size={36} color={colors.bg} style={{ marginBottom: spacing.sm }} />
                      <Text variant="subtitle" color={colors.bg}>Upload Video</Text>
                      <Text variant="caption" color={colors.bg} style={{ opacity: 0.7 }}>Best for experiences</Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <TouchableOpacity
                        style={[styles.uploadButton, styles.uploadButtonSecondary, { flex: 1 }]}
                        onPress={pickImages}
                        disabled={uploading}
                      >
                        <Ionicons name="images-outline" size={32} color={colors.text} style={{ marginBottom: spacing.sm }} />
                        <Text variant="subtitle">Photos</Text>
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
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
                                  TikTok Link
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
                      <Text variant="body" color={colors.coral}>Change Selection</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* STAGE 2: RESTAURANT */}
            {currentStage === 2 && (
              <View style={styles.stageContent}>
                <Text variant="title" style={styles.stageTitle}>Where was this?</Text>
                <Text variant="body" color={colors.muted} style={{ marginBottom: 24 }}>
                  Tag the restaurant so others can find it.
                </Text>

                <TouchableOpacity
                  style={styles.restaurantSelector}
                  onPress={() => setShowRestaurantPicker(true)}
                >
                  {selectedRestaurant ? (
                    <View style={styles.selectedRestaurant}>
                      <View style={[styles.ratingDot, { backgroundColor: ratingColor(selectedRestaurant.rating) }]} />
                      <View style={{ flex: 1 }}>
                        <Text variant="subtitle">{selectedRestaurant.name}</Text>
                        <Text variant="caption" color={colors.muted}>{selectedRestaurant.vicinity || 'No address'}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedRestaurant(null)}>
                        <Ionicons name="close-circle" size={24} color={colors.coral} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="search" size={20} color={colors.primary} />
                      </View>
                      <Text variant="body" color={colors.muted}>Search for location...</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.stageActions}>
                  <TouchableOpacity onPress={() => goToStage(1)} style={styles.backButton}>
                    <Text variant="body">Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => goToStage(3)}
                    style={[styles.nextButton, !selectedRestaurant && { opacity: 0.5 }]}
                    disabled={!selectedRestaurant}
                  >
                    <Text variant="subtitle" color="#fff">Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STAGE 3: DETAILS */}
            {currentStage === 3 && (
              <View style={styles.stageContent}>
                <Text variant="title" style={styles.stageTitle}>Add Details</Text>
                <Text variant="body" color={colors.muted} style={{ marginBottom: 24 }}>
                  Give it a catchy title and tell us more.
                </Text>

                <View style={styles.formContainer}>
                  <View>
                    <Text variant="label" style={styles.sectionLabel}>Title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Best Sushi in Town!"
                      placeholderTextColor={colors.muted}
                      value={title}
                      onChangeText={setTitle}
                      maxLength={100}
                    />
                  </View>

                  <View>
                    <Text variant="label" style={styles.sectionLabel}>Description <Text variant="caption" color={colors.muted}>(Optional)</Text></Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="What did you order? How was the service?"
                      placeholderTextColor={colors.muted}
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      maxLength={500}
                    />
                  </View>

                  <View style={styles.stageActions}>
                    <TouchableOpacity onPress={() => goToStage(2)} style={styles.backButton}>
                      <Text variant="body">Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.nextButton,
                        (uploading || !title.trim()) && { opacity: 0.5 }
                      ]}
                      onPress={handleUpload}
                      disabled={uploading || !title.trim()}
                    >
                      {uploading ? (
                        <ActivityIndicator color={colors.bg} />
                      ) : (
                        <Text variant="subtitle" color={'#fff'}>Post Review</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

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
  uploadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    minWidth: 200,
    alignItems: 'center',
  },

  // Stage UI Styles
  headerContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  stageProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    gap: 4,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.surface,
  },
  stageActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stageContent: {
    // Content layout
  },
  stageTitle: {
    marginBottom: spacing.lg,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  stageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  nextButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    minWidth: 120,
    alignItems: 'center',
  },
});
