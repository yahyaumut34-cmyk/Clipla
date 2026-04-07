class JobData {
  final String jobId;
  final double duration;
  final dynamic file; // PlatformFile or local path

  const JobData({
    required this.jobId,
    required this.duration,
    this.file,
  });
}
