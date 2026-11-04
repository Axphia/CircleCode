/**
 * CircleCode Android JNI Bridge (v1.1.7)
 * Connects org.axphia.circlecode.CircleCode (Java/Kotlin) to circlecode.h (Rust C ABI).
 */

#include <jni.h>
#include <stddef.h>
#include <stdint.h>
#include "../../include/circlecode.h"

JNIEXPORT jstring JNICALL
Java_org_axphia_circlecode_CircleCode_encodeSvgNative(
    JNIEnv* env,
    jclass clazz,
    jstring payloadStr,
    jint rings,
    jfloat density,
    jboolean loncle,
    jstring centerStr
) {
    (void)clazz;
    if (payloadStr == NULL) return NULL;

    const char* payload = (*env)->GetStringUTFChars(env, payloadStr, NULL);
    const char* center = centerStr != NULL ? (*env)->GetStringUTFChars(env, centerStr, NULL) : "Pay";

    char* svg_ptr = circlecode_encode_svg(
        payload,
        (size_t)(rings <= 0 ? 5 : rings),
        (float)density,
        loncle ? 1 : 0,
        center
    );

    (*env)->ReleaseStringUTFChars(env, payloadStr, payload);
    if (centerStr != NULL) {
        (*env)->ReleaseStringUTFChars(env, centerStr, center);
    }

    if (svg_ptr == NULL) return NULL;
    jstring out = (*env)->NewStringUTF(env, svg_ptr);
    circlecode_free_string(svg_ptr);
    return out;
}

JNIEXPORT jstring JNICALL
Java_org_axphia_circlecode_CircleCode_scanRgbaJsonNative(
    JNIEnv* env,
    jclass clazz,
    jbyteArray rgbaArray,
    jint width,
    jint height,
    jboolean aggressive
) {
    (void)clazz;
    if (rgbaArray == NULL || width <= 0 || height <= 0) {
        return (*env)->NewStringUTF(env, "{\"ok\":false,\"reason\":\"Invalid arguments\"}");
    }

    jsize len = (*env)->GetArrayLength(env, rgbaArray);
    jbyte* elems = (*env)->GetByteArrayElements(env, rgbaArray, NULL);
    if (elems == NULL) {
        return (*env)->NewStringUTF(env, "{\"ok\":false,\"reason\":\"JNI buffer lock failed\"}");
    }

    char* json_ptr = circlecode_scan_rgba_json(
        (const uint8_t*)elems,
        (size_t)len,
        (size_t)width,
        (size_t)height,
        aggressive ? 1 : 0
    );

    (*env)->ReleaseByteArrayElements(env, rgbaArray, elems, JNI_ABORT);

    if (json_ptr == NULL) {
        return (*env)->NewStringUTF(env, "{\"ok\":false,\"reason\":\"Decode error\"}");
    }

    jstring result = (*env)->NewStringUTF(env, json_ptr);
    circlecode_free_string(json_ptr);
    return result;
}
