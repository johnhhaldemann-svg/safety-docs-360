import * as ImagePicker from "expo-image-picker";

export async function pickPhotoFromCamera() {
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

export async function pickPhotoFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library permission is required to choose photos from your phone.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.75
  });
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

export async function pickPhoto() {
  return pickPhotoFromCamera();
}
