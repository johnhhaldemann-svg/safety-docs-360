import * as ImagePicker from "expo-image-picker";

export async function pickPhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required to take photos.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.75
  });
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}
