import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import '../theme/app_theme.dart';

class ChatBubble extends StatelessWidget {
  final ChatMessage message;

  const ChatBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final isAi = message.role == ChatRole.ai;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isAi) ...[
            _avatar(),
            const SizedBox(width: 8),
            Flexible(child: _bubble(isAi)),
          ] else ...[
            const Spacer(),
            Flexible(child: _bubble(isAi)),
            const SizedBox(width: 8),
            _userAvatar(),
          ],
        ],
      ),
    );
  }

  Widget _avatar() {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: C.accent.withValues(alpha: 0.1),
        border: Border.all(color: C.accent.withValues(alpha: 0.35)),
      ),
      child: const Center(
        child: Text('C', style: TextStyle(fontSize: 11, color: C.accent)),
      ),
    );
  }

  Widget _userAvatar() {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: C.muted.withValues(alpha: 0.2),
        border: Border.all(color: C.border),
      ),
      child: const Center(
        child: Text('S', style: TextStyle(fontSize: 11, color: C.dim)),
      ),
    );
  }

  Widget _bubble(bool isAi) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 280),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isAi ? C.card : C.accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.only(
          topLeft:     Radius.circular(isAi ? 4 : 12),
          topRight:    Radius.circular(isAi ? 12 : 4),
          bottomLeft:  const Radius.circular(12),
          bottomRight: const Radius.circular(12),
        ),
        border: Border.all(
          color: isAi ? C.border : C.accent.withValues(alpha: 0.3),
        ),
      ),
      child: Text(
        message.text,
        style: TextStyle(
          color: isAi ? C.txt : C.txt,
          fontSize: 13,
          height: 1.45,
        ),
      ),
    );
  }
}
