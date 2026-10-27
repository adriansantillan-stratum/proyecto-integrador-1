import '../../domain/entities/user.dart';

class UserModel extends User {
  UserModel({
    required super.id,
    required super.email,
    required super.name,
    required super.token,
    required super.roles,
    required super.subject,
    required super.refreshToken,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      token: json['access_token'] ?? json['token'] ?? '',
      roles: List<String>.from(json['roles'] ?? []),
      subject: json['subject']?.toString() ?? '',
      refreshToken: json['refresh_token'] ?? json['refreshToken'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'token': token,
      'roles': roles,
      'subject': subject,
      'refreshToken': refreshToken,
    };
  }
}
