// Simple in-memory token store
const tokenStore = new Map();

export const saveToken = (shopUrl, token) => {
  try {
    tokenStore.set(shopUrl, token);
    console.log(`✅ Token saved for ${shopUrl}:`, token);
    console.log(`📊 Current store size:`, tokenStore.size);
    return true;
  } catch (error) {
    console.error('❌ Error saving token:', error);
    return false;
  }
};

export const getToken = (shopUrl) => {
  try {
    const token = tokenStore.get(shopUrl);
    console.log(`🔍 Token retrieved for ${shopUrl}:`, token);
    return token || null;
  } catch (error) {
    console.error('❌ Error retrieving token:', error);
    return null;
  }
};

export const getAllTokens = () => {
  console.log('📋 All stored tokens:');
  tokenStore.forEach((token, shop) => {
    console.log(`  ${shop}: ${token}`);
  });
  return Object.fromEntries(tokenStore);
};

export const deleteToken = (shopUrl) => {
  try {
    const result = tokenStore.delete(shopUrl);
    console.log(`🗑️ Token deleted for ${shopUrl}:`, result);
    return result;
  } catch (error) {
    console.error('❌ Error deleting token:', error);
    return false;
  }
};