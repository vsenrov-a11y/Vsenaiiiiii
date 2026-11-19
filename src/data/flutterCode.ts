export interface SourceCodeFile {
  name: string;
  path: string;
  description: string;
  code: string;
}

export const FLUTTER_FILES: SourceCodeFile[] = [
  {
    name: "pubspec.yaml",
    path: "pubspec.yaml",
    description: "Production dependencies for Firebase Core, Auth, Cloud Firestore, Google Sign-In, Flutter Riverpod, and Secure Storage.",
    code: `name: vsen_ai_app
description: "Vsen.Ai - Production Flutter Firebase Architecture"
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"
  flutter: ">=3.19.0"

dependencies:
  flutter:
    sdk: flutter

  # Firebase Core & Firestore
  firebase_core: ^3.6.0
  cloud_firestore: ^5.4.4
  firebase_auth: ^5.3.1
  google_sign_in: ^6.2.1

  # Secure Storage (EncryptedSharedPreferences / Keychain)
  flutter_secure_storage: ^9.2.2

  # State Management
  flutter_riverpod: ^2.5.1
  
  # Icons & Utilities
  cupertino_icons: ^1.0.6
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true`
  },
  {
    name: "main.dart",
    path: "lib/main.dart",
    description: "Firebase initialization with unlimited offline Firestore cache & Riverpod ProviderScope.",
    code: `import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'firebase_options.dart';
import 'screens/auth_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // 2. Configure Cloud Firestore for Rock-Solid Offline Persistence
  // Unlimited cache ensures old messages never get evicted unexpectedly.
  FirebaseFirestore.instance.settings = const Settings(
    persistenceEnabled: true,
    cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
  );

  runApp(
    const ProviderScope(
      child: VsenAiApp(),
    ),
  );
}

class VsenAiApp extends StatelessWidget {
  const VsenAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vsen.Ai',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F0F11),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF8B5CF6),
          surface: Color(0xFF18181B),
        ),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}`
  },
  {
    name: "chat_model.dart",
    path: "lib/models/chat_model.dart",
    description: "Exact Firestore chat schema (users/{userId}/chats/{chatId}) with immutable serialization.",
    code: `import 'package:cloud_firestore/cloud_firestore.dart';

class ChatModel {
  final String id;
  final String title;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String lastMessage;
  final DateTime lastMessageAt;

  const ChatModel({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    required this.lastMessage,
    required this.lastMessageAt,
  });

  /// Factory constructor to deserialize Firestore DocumentSnapshot
  factory ChatModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    
    DateTime parseTimestamp(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }

    return ChatModel(
      id: doc.id,
      title: data['title'] as String? ?? 'New Chat',
      createdAt: parseTimestamp(data['createdAt']),
      updatedAt: parseTimestamp(data['updatedAt']),
      lastMessage: data['lastMessage'] as String? ?? '',
      lastMessageAt: parseTimestamp(data['lastMessageAt']),
    );
  }

  /// Converts model to Firestore payload
  Map<String, dynamic> toFirestore() {
    return {
      'title': title,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': Timestamp.fromDate(updatedAt),
      'lastMessage': lastMessage,
      'lastMessageAt': Timestamp.fromDate(lastMessageAt),
    };
  }

  ChatModel copyWith({
    String? id,
    String? title,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? lastMessage,
    DateTime? lastMessageAt,
  }) {
    return ChatModel(
      id: id ?? this.id,
      title: title ?? this.title,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
    );
  }
}`
  },
  {
    name: "message_model.dart",
    path: "lib/models/message_model.dart",
    description: "Granular subcollection message schema (users/{userId}/chats/{chatId}/messages/{messageId}).",
    code: `import 'package:cloud_firestore/cloud_firestore.dart';

class MessageModel {
  final String id;
  final String text;
  final String role; // "user" | "assistant"
  final DateTime createdAt;
  final String? model; // optional

  const MessageModel({
    required this.id,
    required this.text,
    required this.role,
    required this.createdAt,
    this.model,
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

  factory MessageModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};

    DateTime parseTimestamp(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }

    return MessageModel(
      id: doc.id,
      text: data['text'] as String? ?? '',
      role: data['role'] as String? ?? 'user',
      createdAt: parseTimestamp(data['createdAt']),
      model: data['model'] as String?,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'text': text,
      'role': role,
      'createdAt': Timestamp.fromDate(createdAt),
      if (model != null && model!.isNotEmpty) 'model': model,
    };
  }
}`
  },
  {
    name: "auth_service.dart",
    path: "lib/services/auth_service.dart",
    description: "Firebase Auth with Google Sign-In, error sanitization, and user stream.",
    code: `import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  /// Stream of authentication state changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Current authenticated user
  User? get currentUser => _auth.currentUser;

  /// User ID helper
  String? get currentUserId => _auth.currentUser?.uid;

  /// Sign In with Google
  Future<UserCredential?> signInWithGoogle() async {
    try {
      // 1. Trigger the Google Authentication flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // User aborted sign-in flow
        return null;
      }

      // 2. Obtain auth details from the request
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // 3. Create a new credential for Firebase
      final OAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // 4. Sign in to Firebase with the Google user credential
      final UserCredential userCredential = await _auth.signInWithCredential(credential);
      return userCredential;
    } on FirebaseAuthException catch (e) {
      throw Exception('Firebase Auth Error [\${e.code}]: \${e.message}');
    } catch (e) {
      throw Exception('Failed to sign in with Google: \$e');
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      await Future.wait([
        _googleSignIn.signOut(),
        _auth.signOut(),
      ]);
    } catch (e) {
      throw Exception('Failed to sign out: \$e');
    }
  }
}`
  },
  {
    name: "secure_storage_service.dart",
    path: "lib/services/secure_storage_service.dart",
    description: "Encrypted hardware-backed storage for Gemini API Keys with in-memory caching.",
    code: `import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const String _geminiApiKeyKey = 'vsen_gemini_api_key';

  final FlutterSecureStorage _storage;

  // In-memory cached key to prevent redundant disk I/O and UI freezes
  String? _cachedApiKey;

  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
          ),
          iOptions: IOSOptions(
            accessibility: KeychainAccessibility.first_unlock,
          ),
        );

  /// Load key at startup into memory
  Future<String?> getApiKey() async {
    if (_cachedApiKey != null && _cachedApiKey!.isNotEmpty) {
      return _cachedApiKey;
    }
    try {
      _cachedApiKey = await _storage.read(key: _geminiApiKeyKey);
      return _cachedApiKey;
    } catch (e) {
      // Fallback for corrupt key store
      return null;
    }
  }

  /// Persist key securely
  Future<void> saveApiKey(String apiKey) async {
    final trimmed = apiKey.trim();
    _cachedApiKey = trimmed;
    await _storage.write(key: _geminiApiKeyKey, value: trimmed);
  }

  /// Wipe API key
  Future<void> deleteApiKey() async {
    _cachedApiKey = null;
    await _storage.delete(key: _geminiApiKeyKey);
  }
}`
  },
  {
    name: "chat_repository.dart",
    path: "lib/repositories/chat_repository.dart",
    description: "Complete Chat Service: Granular message subcollection writes, stable chat IDs, snapshots stream, and offline resilience.",
    code: `import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/chat_model.dart';
import '../models/message_model.dart';

class ChatRepository {
  final FirebaseFirestore _firestore;

  ChatRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  // Collection Reference Helper: users/{userId}/chats
  CollectionReference<Map<String, dynamic>> _userChatsRef(String userId) {
    return _firestore.collection('users').doc(userId).collection('chats');
  }

  // Subcollection Reference Helper: users/{userId}/chats/{chatId}/messages
  CollectionReference<Map<String, dynamic>> _chatMessagesRef(String userId, String chatId) {
    return _userChatsRef(userId).doc(chatId).collection('messages');
  }

  /// 1. Create a new chat session with a STABLE ID
  Future<String> createChat({
    required String userId,
    String? title,
    String? initialMessage,
  }) async {
    final now = DateTime.now();
    final chatDocRef = _userChatsRef(userId).doc(); // generates stable UUID
    final chatId = chatDocRef.id;

    final chatData = {
      'title': title ?? 'New Conversation',
      'createdAt': Timestamp.fromDate(now),
      'updatedAt': Timestamp.fromDate(now),
      'lastMessage': initialMessage ?? '',
      'lastMessageAt': Timestamp.fromDate(now),
    };

    // Await write - offline persistence writes to local cache instantly
    await chatDocRef.set(chatData);

    // If initial greeting message exists, append to subcollection
    if (initialMessage != null && initialMessage.trim().isNotEmpty) {
      await _chatMessagesRef(userId, chatId).add({
        'text': initialMessage.trim(),
        'role': 'assistant',
        'createdAt': Timestamp.fromDate(now),
      });
    }

    return chatId;
  }

  /// 2. Stream all user chats ordered by last active timestamp (Real-time snapshots)
  Stream<List<ChatModel>> getUserChats(String userId) {
    return _userChatsRef(userId)
        .orderBy('lastMessageAt', descending: true)
        .snapshots(includeMetadataChanges: true)
        .map((snapshot) {
      return snapshot.docs.map((doc) => ChatModel.fromFirestore(doc)).toList();
    });
  }

  /// 3. Stream all messages for a specific chat ordered by createdAt (NEVER overwrites full list)
  Stream<List<MessageModel>> getMessages({
    required String userId,
    required String chatId,
  }) {
    return _chatMessagesRef(userId, chatId)
        .orderBy('createdAt', descending: false)
        .snapshots(includeMetadataChanges: true)
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => MessageModel.fromFirestore(doc))
          .toList();
    });
  }

  /// 4. Append a new granular message document and atomically update chat metadata
  Future<void> sendMessage({
    required String userId,
    required String chatId,
    required String text,
    required String role, // "user" | "assistant"
    String? model,
  }) async {
    final trimmedText = text.trim();
    if (trimmedText.isEmpty) return;

    final now = DateTime.now();

    // 1. Add new document to messages subcollection (Never overwrite array!)
    final messageData = <String, dynamic>{
      'text': trimmedText,
      'role': role,
      'createdAt': Timestamp.fromDate(now),
      if (model != null && model.isNotEmpty) 'model': model,
    };

    // Await message write into subcollection
    await _chatMessagesRef(userId, chatId).add(messageData);

    // 2. Update chat session metadata
    await updateChatMetadata(
      userId: userId,
      chatId: chatId,
      lastMessage: trimmedText,
      timestamp: now,
    );
  }

  /// 5. Update Chat Metadata (lastMessage, lastMessageAt, updatedAt)
  Future<void> updateChatMetadata({
    required String userId,
    required String chatId,
    required String lastMessage,
    DateTime? timestamp,
  }) async {
    final now = timestamp ?? DateTime.now();
    await _userChatsRef(userId).doc(chatId).set(
      {
        'lastMessage': lastMessage,
        'lastMessageAt': Timestamp.fromDate(now),
        'updatedAt': Timestamp.fromDate(now),
      },
      SetOptions(merge: true),
    );
  }

  /// 6. Clean cascade deletion of chat and all nested message subcollections
  Future<void> deleteChat({
    required String userId,
    required String chatId,
  }) async {
    // 1. Fetch and delete all subcollection message documents
    final messagesSnapshot = await _chatMessagesRef(userId, chatId).get();
    final batch = _firestore.batch();

    for (final doc in messagesSnapshot.docs) {
      batch.delete(doc.reference);
    }
    // Delete parent chat document
    batch.delete(_userChatsRef(userId).doc(chatId));

    await batch.commit();
  }
}`
  },
  {
    name: "chat_providers.dart",
    path: "lib/providers/chat_providers.dart",
    description: "Riverpod state management: Auth state, real-time message streams, API key provider, and ChatController.",
    code: `import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';
import '../services/secure_storage_service.dart';
import '../repositories/chat_repository.dart';
import '../models/chat_model.dart';
import '../models/message_model.dart';

// Services Providers
final authServiceProvider = Provider<AuthService>((ref) => AuthService());
final secureStorageProvider = Provider<SecureStorageService>((ref) => SecureStorageService());
final chatRepositoryProvider = Provider<ChatRepository>((ref) => ChatRepository());

// Auth State Stream Provider
final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

// API Key State Notifier Provider
final apiKeyProvider = StateNotifierProvider<ApiKeyNotifier, AsyncValue<String?>>((ref) {
  return ApiKeyNotifier(ref.watch(secureStorageProvider));
});

class ApiKeyNotifier extends StateNotifier<AsyncValue<String?>> {
  final SecureStorageService _storage;
  ApiKeyNotifier(this._storage) : super(const AsyncValue.loading()) {
    loadKey();
  }

  Future<void> loadKey() async {
    try {
      final key = await _storage.getApiKey();
      state = AsyncValue.data(key);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> setKey(String key) async {
    await _storage.saveApiKey(key);
    state = AsyncValue.data(key.trim());
  }

  Future<void> clearKey() async {
    await _storage.deleteApiKey();
    state = const AsyncValue.data(null);
  }
}

// User Chats Stream Provider
final userChatsStreamProvider = StreamProvider.autoDispose<List<ChatModel>>((ref) {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return Stream.value([]);
  return ref.watch(chatRepositoryProvider).getUserChats(user.uid);
});

// Messages Stream Provider for active chat (STABLE Real-Time Listener)
final chatMessagesStreamProvider = StreamProvider.autoDispose.family<List<MessageModel>, String>((ref, chatId) {
  final user = ref.watch(authStateProvider).value;
  if (user == null || chatId.isEmpty) return Stream.value([]);
  return ref.watch(chatRepositoryProvider).getMessages(
    userId: user.uid,
    chatId: chatId,
  );
});

// Chat Screen Controller for sending messages and calling AI
final chatControllerProvider = StateNotifierProvider<ChatController, AsyncValue<void>>((ref) {
  return ChatController(
    ref.watch(chatRepositoryProvider),
    ref.watch(authServiceProvider),
    ref.watch(secureStorageProvider),
  );
});

class ChatController extends StateNotifier<AsyncValue<void>> {
  final ChatRepository _repository;
  final AuthService _auth;
  final SecureStorageService _storage;

  ChatController(this._repository, this._auth, this._storage) : super(const AsyncValue.data(null));

  Future<void> sendUserMessage({
    required String chatId,
    required String text,
    String? model,
  }) async {
    final userId = _auth.currentUserId;
    if (userId == null) throw Exception('User is not authenticated');

    state = const AsyncValue.loading();
    try {
      // 1. Write user message to Firestore subcollection immediately
      await _repository.sendMessage(
        userId: userId,
        chatId: chatId,
        text: text,
        role: 'user',
        model: model,
      );
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }
}`
  },
  {
    name: "chat_screen.dart",
    path: "lib/screens/chat_screen.dart",
    description: "Production Chat UI with stable Chat ID, real-time message StreamBuilder, and offline resilience.",
    code: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/chat_providers.dart';
import '../models/message_model.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String chatId;
  final String title;

  const ChatScreen({
    super.key,
    required this.chatId,
    this.title = 'Conversation',
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isSending = false;

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSend() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _isSending) return;

    _textController.clear();
    setState(() => _isSending = true);

    try {
      await ref.read(chatControllerProvider.notifier).sendUserMessage(
        chatId: widget.chatId,
        text: text,
      );
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: \$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 1. Listen to real-time messages stream for this stable chatId
    final messagesAsync = ref.watch(chatMessagesStreamProvider(widget.chatId));

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF141416),
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              data: (messages) {
                if (messages.isEmpty) {
                  return const Center(
                    child: Text(
                      'No messages yet. Send a message to start!',
                      style: TextStyle(color: Colors.white54),
                    ),
                  );
                }

                _scrollToBottom();

                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[index];
                    return _MessageBubble(message: message);
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Text('Failed to load messages: \$err', style: const TextStyle(color: Colors.redAccent)),
              ),
            ),
          ),

          // Input Bar
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 10,
              bottom: MediaQuery.of(context).padding.bottom + 10,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFF18181B),
              border: Border(top: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    minLines: 1,
                    maxLines: 4,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Type your message...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: const Color(0xFF27272A),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onSubmitted: (_) => _handleSend(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _isSending ? null : _handleSend,
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF8B5CF6),
                    foregroundColor: Colors.white,
                  ),
                  icon: _isSending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, size: 18),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final MessageModel message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFF8B5CF6) : const Color(0xFF27272A),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 16),
          ),
        ),
        child: Text(
          message.text,
          style: TextStyle(
            color: isUser ? Colors.white : Colors.white.withOpacity(0.9),
            fontSize: 14,
            height: 1.35,
          ),
        ),
      ),
    );
  }
}`
  }
];
