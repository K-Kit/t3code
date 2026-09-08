import { Alert } from "react-native";
import type { DocumentDownload } from "@t3tools/contracts";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { uuidv4 } from "../../lib/uuid";

export async function shareDocument(download: typeof DocumentDownload.Type, httpBaseUrl: string) {
  if (!FileSystem.cacheDirectory) {
    Alert.alert("Could not save export", "Temporary storage is unavailable. Please try again.");
    return;
  }
  const fileName = download.fileName.replace(/[^\p{L}\p{N} ._-]/gu, "_");
  const destination = `${FileSystem.cacheDirectory}workspace-${uuidv4()}-${fileName}`;
  const file = await FileSystem.downloadAsync(
    new URL(download.relativeUrl, httpBaseUrl).toString(),
    destination,
  );
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, { dialogTitle: download.fileName });
  else Alert.alert("Export saved", file.uri);
}
