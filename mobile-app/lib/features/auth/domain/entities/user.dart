class User {
  final String id;
  final String email;
  final String name;
  final String token;
  final List<String> roles;
  final String subject;
  final String refreshToken;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.token,
    required this.roles,
    required this.subject,
    required this.refreshToken,
  });
}
