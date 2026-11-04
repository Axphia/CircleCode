cmake_minimum_required(VERSION 3.14)
project(circlecode_cpp_sample LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(circlecode_sample main.cpp)
target_include_directories(circlecode_sample PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/../../native/include")

# Link against compiled circlecode_core library in native/rust/target/release
target_link_directories(circlecode_sample PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/../../native/rust/target/release")
target_link_libraries(circlecode_sample PRIVATE circlecode_core)

