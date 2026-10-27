class ApiConfig {
  static const backendUrl = String.fromEnvironment('API_BASE_URL',
      defaultValue: 'http://10.0.2.2:8081');
  static const identityUrl = String.fromEnvironment('KEYCLOAK_BASE_URL',
      defaultValue: 'http://10.0.2.2:8080');
  static const realm =
      String.fromEnvironment('KEYCLOAK_REALM', defaultValue: 'ecoroute');
  static const clientId =
      String.fromEnvironment('KEYCLOAK_CLIENT_ID', defaultValue: 'mobile-app');
  static String get oidcPath => '/realms/$realm/protocol/openid-connect';
}
