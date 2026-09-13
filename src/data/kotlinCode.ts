import { KotlinFile } from '../types';

export const KOTLIN_FILES: KotlinFile[] = [
  {
    name: "MainActivity.kt",
    path: "app/src/main/java/ai/vsen/app/MainActivity.kt",
    description: "Main entry point setting up edge-to-edge Jetpack Compose navigation and theme.",
    code: `package ai.vsen.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import ai.vsen.app.ui.navigation.VsenNavHost
import ai.vsen.app.ui.theme.VsenTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VsenTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = ai.vsen.app.ui.theme.DeepSlateBg
                ) {
                    val navController = rememberNavController()
                    VsenNavHost(navController = navController)
                }
            }
        }
    }
}`
  },
  {
    name: "VsenTheme.kt",
    path: "app/src/main/java/ai/vsen/app/ui/theme/VsenTheme.kt",
    description: "iOS & One UI inspired minimalist color scheme and typography definitions.",
    code: `package ai.vsen.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.GoogleFont
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ai.vsen.app.R

val DeepSlateBg = Color(0xFF121212)
val CardSurface = Color(0xFF1E1E1E)
val UserBubbleSurface = Color(0xFF2A2A2A)
val SilverAccent = Color(0xFFE0E0E0)
val CrispWhite = Color(0xFFFFFFFF)
val SubtleGray = Color(0xFF888888)

val SquircleShape = RoundedCornerShape(24.dp)
val PillShape = RoundedCornerShape(999.dp)

// Google Fonts Provider Setup for Inter
val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs
)

val InterFont = GoogleFont("Inter")

val InterFontFamily = FontFamily(
    Font(googleFont = InterFont, fontProvider = provider, weight = FontWeight.Light),
    Font(googleFont = InterFont, fontProvider = provider, weight = FontWeight.Normal),
    Font(googleFont = InterFont, fontProvider = provider, weight = FontWeight.Medium),
    Font(googleFont = InterFont, fontProvider = provider, weight = FontWeight.Bold)
)

// Premium typography configuration with spacious tracking & leading
val VsenTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 40.sp,
        letterSpacing = 0.5.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.25.sp
    ),
    titleLarge = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.15.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.5.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp
    ),
    labelMedium = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Light,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    labelSmall = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Light,
        fontSize = 10.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.5.sp
    )
)

private val DarkColorScheme = darkColorScheme(
    background = DeepSlateBg,
    surface = CardSurface,
    primary = SilverAccent,
    onPrimary = DeepSlateBg,
    onBackground = CrispWhite,
    onSurface = CrispWhite
)

@Composable
fun VsenTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        shapes = MaterialTheme.shapes.copy(
            large = SquircleShape,
            medium = RoundedCornerShape(16.dp)
        ),
        typography = VsenTypography,
        content = content
    )
}`
  },
  {
    name: "SecureStorageManager.kt",
    path: "app/src/main/java/ai/vsen/app/data/SecureStorageManager.kt",
    description: "Local-only API Key storage using Android EncryptedSharedPreferences.",
    code: `package ai.vsen.app.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecureStorageManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "vsen_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveApiKey(key: String) {
        sharedPreferences.edit().putString("gemini_api_key", key).apply()
    }

    fun getApiKey(): String? {
        return sharedPreferences.getString("gemini_api_key", null)
    }
}`
  },
  {
    name: "GeminiRepository.kt",
    path: "app/src/main/java/ai/vsen/app/data/GeminiRepository.kt",
    description: "Retrofit/Ktor streaming repository connecting to Google Gemini API.",
    code: `package ai.vsen.app.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import org.json.JSONArray
import org.json.JSONObject

class GeminiRepository(private val secureStorage: SecureStorageManager) {
    private val client = OkHttpClient.Builder().build()

    fun streamChat(
        message: String,
        systemInstruction: String
    ): Flow<String> = flow {
        val apiKey = secureStorage.getApiKey() ?: throw IllegalStateException("API Key Missing")
        val url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=$apiKey"
        
        // Build payload
        val payload = JSONObject().apply {
            put("system_instruction", JSONObject().apply {
                put("parts", JSONObject().apply { put("text", systemInstruction) })
            })
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", message) })
                    })
                })
            })
        }

        // SSE Request handling via OkHttp EventSources
        // Real implementation emits chunks as they arrive over network
    }
}`
  },
  {
    name: "ChatScreen.kt",
    path: "app/src/main/java/ai/vsen/app/ui/chat/ChatScreen.kt",
    description: "Jetpack Compose chat UI with squircle bubbles and pill input bar.",
    code: `package ai.vsen.app.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ai.vsen.app.ui.theme.*

@Composable
fun ChatScreen(viewModel: ChatViewModel) {
    val messages by viewModel.messages.collectAsState()
    var inputText by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepSlateBg)
            .padding(top = 48.dp, bottom = 24.dp)
    ) {
        LazyColumn(
            modifier = Modifier.weight(1f).padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(messages) { msg ->
                ChatBubble(message = msg)
            }
        }

        // Pill Input Bar
        Row(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .background(CardSurface, shape = PillShape)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = { Text("Type a message...", color = SubtleGray) },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                modifier = Modifier.weight(1f)
            )
            IconButton(
                onClick = {
                    if (inputText.isNotBlank()) {
                        viewModel.sendMessage(inputText)
                        inputText = ""
                    }
                }
            ) {
                // Send Icon
            }
        }
    }
}`
  }
];
