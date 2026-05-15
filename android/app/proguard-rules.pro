# Cat Android ProGuard Rules

# Keep Chaquopy
-keep class com.chaquo.** { *; }
-dontwarn com.chaquo.**

# Keep Python modules
-keep class org.python.** { *; }
-dontwarn org.python.**

# Keep FastAPI
-keep class fastapi.** { *; }
-dontwarn fastapi.**

# Keep Pydantic
-keep class pydantic.** { *; }
-dontwarn pydantic.**

# Keep SQLAlchemy
-keep class sqlalchemy.** { *; }
-dontwarn sqlalchemy.**

# Keep application classes
-keep class com.cat.app.** { *; }
