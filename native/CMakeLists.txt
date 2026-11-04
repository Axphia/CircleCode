cmake_minimum_required(VERSION 3.14)
project(circlecode_native LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Header-only interface for C / C++ consumers linking against prebuilt libcirclecode_core
add_library(circlecode_headers INTERFACE)
target_include_directories(circlecode_headers INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}/include")

# Optional Android JNI bridge shared library target
if(ANDROID)
    add_library(circlecode_jni SHARED
        "${CMAKE_CURRENT_SOURCE_DIR}/bindings/java/circlecode_jni.c"
    )
    target_include_directories(circlecode_jni PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include")
endif()

