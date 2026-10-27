import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';

/// In-process transport: no sockets, credentials, emulator or live backend.
class SessionNavigationAdapter implements HttpClientAdapter {
  final FutureOr<ResponseBody> Function(RequestOptions) answer;
  SessionNavigationAdapter(this.answer);

  @override
  Future<ResponseBody> fetch(RequestOptions options,
          Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async =>
      answer(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody sessionResponse(Object? body, [int status = 200]) =>
    ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType]
    });

String sessionToken(DateTime expires) =>
    'header.${base64Url.encode(utf8.encode(jsonEncode({
              'exp': expires.millisecondsSinceEpoch ~/ 1000,
            }))).replaceAll('=', '')}.signature';
