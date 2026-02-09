/**
 * Explore Tab - AI Chat with Restaurant Search
 * ChatGPT-style interface with simulated results for demo
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';

// Message types
type MessageType = 'user' | 'assistant' | 'results';

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  results?: RestaurantResult[];
  timestamp: Date;
}

interface RestaurantResult {
  id: string;
  name: string;
  rating: number;
  priceLevel: number;
  distance: string;
  address: string;
  image: string;
  cuisine: string;
  deliveryTime: string;
  deliveryFee: string;
}

// Simulated demo results - always returned regardless of query
const DEMO_RESULTS: RestaurantResult[] = [
  {
    id: '1',
    name: 'Kung Fu Tea',
    rating: 4.5,
    priceLevel: 1,
    distance: '0.3 mi',
    address: '512 E Green St, Champaign, IL',
    image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400',
    cuisine: 'Bubble Tea',
    deliveryTime: '15-25 min',
    deliveryFee: '$1.99',
  },
  {
    id: '2',
    name: 'Teamoji',
    rating: 4.7,
    priceLevel: 1,
    distance: '0.5 mi',
    address: '616 E Green St, Champaign, IL',
    image: 'https://images.unsplash.com/photo-1525803377221-99c58b1e3fc6?w=400',
    cuisine: 'Bubble Tea • Desserts',
    deliveryTime: '20-30 min',
    deliveryFee: '$2.49',
  },
  {
    id: '3',
    name: 'ShareTea',
    rating: 4.3,
    priceLevel: 2,
    distance: '0.8 mi',
    address: '703 S Wright St, Champaign, IL',
    image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400',
    cuisine: 'Bubble Tea • Snacks',
    deliveryTime: '25-35 min',
    deliveryFee: '$0.99',
  },
];

// Demo results sorted by rating for second query
const DEMO_RESULTS_BY_RATING: RestaurantResult[] = [
  {
    id: '2',
    name: 'Teamoji',
    rating: 4.7,
    priceLevel: 1,
    distance: '0.5 mi',
    address: '616 E Green St, Champaign, IL',
    image: 'https://images.unsplash.com/photo-1525803377221-99c58b1e3fc6?w=400',
    cuisine: 'Bubble Tea • Desserts',
    deliveryTime: '20-30 min',
    deliveryFee: '$2.49',
  },
  {
    id: '1',
    name: 'Kung Fu Tea',
    rating: 4.5,
    priceLevel: 1,
    distance: '0.3 mi',
    address: '512 E Green St, Champaign, IL',
    image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=400',
    cuisine: 'Bubble Tea',
    deliveryTime: '15-25 min',
    deliveryFee: '$1.99',
  },
  {
    id: '3',
    name: 'ShareTea',
    rating: 4.3,
    priceLevel: 2,
    distance: '0.8 mi',
    address: '703 S Wright St, Champaign, IL',
    image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400',
    cuisine: 'Bubble Tea • Snacks',
    deliveryTime: '25-35 min',
    deliveryFee: '$0.99',
  },
];

const DEMO_AI_RESPONSE = `I found 3 boba shops near you, sorted by price and distance. Here are your options:`;

const DEMO_AI_RESPONSE_RATING = `Got it! Here are the same shops reordered by rating (highest first):`;

export default function ExploreScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'assistant',
      content: `Hi! I'm your food discovery assistant. Ask me anything like:\n\n"Cheapest boba near me"\n"Best rated pizza"\n"Late night food open now"`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [queryCount, setQueryCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Simulate AI response
  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI "thinking" delay
    setTimeout(() => {
      const isSecondQuery = queryCount >= 1;

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'assistant',
        content: isSecondQuery ? DEMO_AI_RESPONSE_RATING : DEMO_AI_RESPONSE,
        timestamp: new Date(),
      };

      const resultsMessage: ChatMessage = {
        id: `results-${Date.now()}`,
        type: 'results',
        content: '',
        results: isSecondQuery ? DEMO_RESULTS_BY_RATING : DEMO_RESULTS,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage, resultsMessage]);
      setQueryCount(prev => prev + 1);
      setIsTyping(false);
    }, 1500);
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleOrderPress = (restaurant: RestaurantResult) => {
    // Demo: Open Google Maps
    const url = `https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`;
    Linking.openURL(url);
  };

  const renderPriceLevel = (level: number) => {
    return '$'.repeat(level) + '$'.repeat(4 - level).split('').map(() => '').join('');
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.type === 'user') {
      return (
        <View style={styles.userMessageContainer}>
          <View style={styles.userBubble}>
            <Text variant="body" color={colors.bg}>{item.content}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'assistant') {
      return (
        <View style={styles.assistantMessageContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View style={styles.assistantBubble}>
            <Text variant="body">{item.content}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'results' && item.results) {
      return (
        <View style={styles.resultsContainer}>
          {item.results.map((restaurant) => (
            <Card key={restaurant.id} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Image
                  source={{ uri: restaurant.image }}
                  style={styles.resultImage}
                />
                <View style={styles.resultInfo}>
                  <Text variant="subtitle" numberOfLines={1}>{restaurant.name}</Text>
                  <View style={styles.ratingRow}>
                    <Text style={styles.star}>★</Text>
                    <Text variant="bodySmall">{restaurant.rating}</Text>
                    <Text variant="bodySmall" color={colors.muted}> • </Text>
                    <Text variant="bodySmall" color={colors.lime}>
                      {'$'.repeat(restaurant.priceLevel)}
                    </Text>
                    <Text variant="bodySmall" color={colors.muted}> • {restaurant.distance}</Text>
                  </View>
                  <Text variant="caption" color={colors.muted}>{restaurant.cuisine}</Text>
                </View>
              </View>

              <View style={styles.deliveryInfo}>
                <View style={styles.deliveryBadge}>
                  <Ionicons name="time-outline" size={14} color={colors.muted} />
                  <Text variant="caption" color={colors.muted}> {restaurant.deliveryTime}</Text>
                </View>
                <View style={styles.deliveryBadge}>
                  <Ionicons name="bicycle-outline" size={14} color={colors.muted} />
                  <Text variant="caption" color={colors.muted}> {restaurant.deliveryFee}</Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.orderButton}
                  onPress={() => handleOrderPress(restaurant)}
                >
                  <Text variant="body" color={colors.bg}>Order Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton}>
                  <Ionicons name="bookmark-outline" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      );
    }

    return null;
  };

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="title">Explore</Text>
          <Text variant="caption" color={colors.muted}>AI-powered food discovery</Text>
        </View>

        {/* Chat Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>C</Text>
            </View>
            <View style={styles.typingBubble}>
              <Text variant="bodySmall" color={colors.muted}>Searching restaurants...</Text>
            </View>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask about food near you..."
              placeholderTextColor={colors.muted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={inputText.trim() ? colors.bg : colors.muted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  messageList: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '80%',
  },
  assistantMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultsContainer: {
    marginLeft: 40,
    marginBottom: spacing.md,
  },
  resultCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  star: {
    color: '#FFD700',
    marginRight: 4,
  },
  deliveryInfo: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  orderButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  typingBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
});
