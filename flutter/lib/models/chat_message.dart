enum ChatRole { user, ai }

class ChatMessage {
  final String id;
  final ChatRole role;
  final String text;

  const ChatMessage({
    required this.id,
    required this.role,
    required this.text,
  });
}
