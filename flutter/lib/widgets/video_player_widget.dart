import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import '../theme/app_theme.dart';

class VideoPlayerWidget extends StatefulWidget {
  final String url;
  final bool autoPlay;

  const VideoPlayerWidget({
    super.key,
    required this.url,
    this.autoPlay = false,
  });

  @override
  State<VideoPlayerWidget> createState() => _VideoPlayerWidgetState();
}

class _VideoPlayerWidgetState extends State<VideoPlayerWidget> {
  VideoPlayerController? _controller;
  ChewieController? _chewieController;
  bool _initialized = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init(widget.url);
  }

  @override
  void didUpdateWidget(VideoPlayerWidget old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url && widget.url.isNotEmpty) {
      _dispose();
      _init(widget.url);
    }
  }

  Future<void> _init(String url) async {
    if (url.isEmpty) return;
    try {
      final controller = VideoPlayerController.networkUrl(Uri.parse(url));
      await controller.initialize();
      final chewie = ChewieController(
        videoPlayerController: controller,
        autoPlay: widget.autoPlay,
        looping: false,
        allowFullScreen: true,
        materialProgressColors: ChewieProgressColors(
          playedColor: C.accent,
          handleColor: C.accent,
          backgroundColor: C.border,
          bufferedColor: C.muted,
        ),
      );
      if (mounted) {
        setState(() {
          _controller = controller;
          _chewieController = chewie;
          _initialized = true;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _error = e.toString(); });
      }
    }
  }

  void _dispose() {
    _chewieController?.dispose();
    _controller?.dispose();
    _chewieController = null;
    _controller = null;
    _initialized = false;
  }

  @override
  void dispose() {
    _dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.url.isEmpty) {
      return _placeholder('Video URL\'si yok');
    }
    if (_error != null) {
      return _placeholder('Video yüklenemedi');
    }
    if (!_initialized || _chewieController == null) {
      return Container(
        height: 220,
        decoration: BoxDecoration(
          color: C.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: C.border),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: C.accent),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: _controller!.value.aspectRatio,
        child: Chewie(controller: _chewieController!),
      ),
    );
  }

  Widget _placeholder(String msg) {
    return Container(
      height: 220,
      decoration: BoxDecoration(
        color: C.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: C.border),
      ),
      child: Center(
        child: Text(msg, style: const TextStyle(color: C.muted, fontSize: 13)),
      ),
    );
  }
}
