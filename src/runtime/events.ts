// Target types were scraped with the following command:
//   rg 'interface (\w+)EventMap\b' -g lib.dom.d.ts -o --replace '$1' --no-filename --no-line-number | pbcopy
export interface AddEventListener {
  <E extends keyof AbortSignalEventMap>(
    target: AbortSignal,
    type: E,
    callback: (event: AbortSignalEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof AnimationEventMap>(
    target: Animation,
    type: E,
    callback: (event: AnimationEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof AudioScheduledSourceNodeEventMap>(
    target: AudioScheduledSourceNode,
    type: E,
    callback: (event: AudioScheduledSourceNodeEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof AudioWorkletNodeEventMap>(
    target: AudioWorkletNode,
    type: E,
    callback: (event: AudioWorkletNodeEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof BaseAudioContextEventMap>(
    target: BaseAudioContext,
    type: E,
    callback: (event: BaseAudioContextEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof BroadcastChannelEventMap>(
    target: BroadcastChannel,
    type: E,
    callback: (event: BroadcastChannelEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof DocumentEventMap>(
    target: Document,
    type: E,
    callback: (event: DocumentEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof ElementEventMap>(
    target: Element,
    type: E,
    callback: (event: ElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof EventSourceEventMap>(
    target: EventSource,
    type: E,
    callback: (event: EventSourceEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof FileReaderEventMap>(
    target: FileReader,
    type: E,
    callback: (event: FileReaderEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof FontFaceSetEventMap>(
    target: FontFaceSet,
    type: E,
    callback: (event: FontFaceSetEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof HTMLBodyElementEventMap>(
    target: HTMLBodyElement,
    type: E,
    callback: (event: HTMLBodyElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: E,
    callback: (event: HTMLElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof HTMLMediaElementEventMap>(
    target: HTMLMediaElement,
    type: E,
    callback: (event: HTMLMediaElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof HTMLVideoElementEventMap>(
    target: HTMLVideoElement,
    type: E,
    callback: (event: HTMLVideoElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof IDBDatabaseEventMap>(
    target: IDBDatabase,
    type: E,
    callback: (event: IDBDatabaseEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof IDBOpenDBRequestEventMap>(
    target: IDBOpenDBRequest,
    type: E,
    callback: (event: IDBOpenDBRequestEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof IDBRequestEventMap>(
    target: IDBRequest,
    type: E,
    callback: (event: IDBRequestEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof IDBTransactionEventMap>(
    target: IDBTransaction,
    type: E,
    callback: (event: IDBTransactionEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MIDIAccessEventMap>(
    target: MIDIAccess,
    type: E,
    callback: (event: MIDIAccessEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MIDIInputEventMap>(
    target: MIDIInput,
    type: E,
    callback: (event: MIDIInputEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MIDIPortEventMap>(
    target: MIDIPort,
    type: E,
    callback: (event: MIDIPortEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MathMLElementEventMap>(
    target: MathMLElement,
    type: E,
    callback: (event: MathMLElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaDevicesEventMap>(
    target: MediaDevices,
    type: E,
    callback: (event: MediaDevicesEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaKeySessionEventMap>(
    target: MediaKeySession,
    type: E,
    callback: (event: MediaKeySessionEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaQueryListEventMap>(
    target: MediaQueryList,
    type: E,
    callback: (event: MediaQueryListEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaRecorderEventMap>(
    target: MediaRecorder,
    type: E,
    callback: (event: MediaRecorderEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaSourceEventMap>(
    target: MediaSource,
    type: E,
    callback: (event: MediaSourceEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaStreamEventMap>(
    target: MediaStream,
    type: E,
    callback: (event: MediaStreamEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MediaStreamTrackEventMap>(
    target: MediaStreamTrack,
    type: E,
    callback: (event: MediaStreamTrackEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof MessagePortEventMap>(
    target: MessagePort,
    type: E,
    callback: (event: MessagePortEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof NotificationEventMap>(
    target: Notification,
    type: E,
    callback: (event: NotificationEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof OfflineAudioContextEventMap>(
    target: OfflineAudioContext,
    type: E,
    callback: (event: OfflineAudioContextEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof OffscreenCanvasEventMap>(
    target: OffscreenCanvas,
    type: E,
    callback: (event: OffscreenCanvasEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof PaymentRequestEventMap>(
    target: PaymentRequest,
    type: E,
    callback: (event: PaymentRequestEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof PerformanceEventMap>(
    target: Performance,
    type: E,
    callback: (event: PerformanceEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof PermissionStatusEventMap>(
    target: PermissionStatus,
    type: E,
    callback: (event: PermissionStatusEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof PictureInPictureWindowEventMap>(
    target: PictureInPictureWindow,
    type: E,
    callback: (event: PictureInPictureWindowEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RTCDTMFSenderEventMap>(
    target: RTCDTMFSender,
    type: E,
    callback: (event: RTCDTMFSenderEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RTCDataChannelEventMap>(
    target: RTCDataChannel,
    type: E,
    callback: (event: RTCDataChannelEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RTCDtlsTransportEventMap>(
    target: RTCDtlsTransport,
    type: E,
    callback: (event: RTCDtlsTransportEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RTCIceTransportEventMap>(
    target: RTCIceTransport,
    type: E,
    callback: (event: RTCIceTransportEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RTCPeerConnectionEventMap>(
    target: RTCPeerConnection,
    type: E,
    callback: (event: RTCPeerConnectionEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RTCSctpTransportEventMap>(
    target: RTCSctpTransport,
    type: E,
    callback: (event: RTCSctpTransportEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof RemotePlaybackEventMap>(
    target: RemotePlayback,
    type: E,
    callback: (event: RemotePlaybackEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof SVGElementEventMap>(
    target: SVGElement,
    type: E,
    callback: (event: SVGElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof SVGSVGElementEventMap>(
    target: SVGSVGElement,
    type: E,
    callback: (event: SVGSVGElementEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof ScreenOrientationEventMap>(
    target: ScreenOrientation,
    type: E,
    callback: (event: ScreenOrientationEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof ServiceWorkerEventMap>(
    target: ServiceWorker,
    type: E,
    callback: (event: ServiceWorkerEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof ServiceWorkerContainerEventMap>(
    target: ServiceWorkerContainer,
    type: E,
    callback: (event: ServiceWorkerContainerEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof ServiceWorkerRegistrationEventMap>(
    target: ServiceWorkerRegistration,
    type: E,
    callback: (event: ServiceWorkerRegistrationEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof ShadowRootEventMap>(
    target: ShadowRoot,
    type: E,
    callback: (event: ShadowRootEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof SourceBufferEventMap>(
    target: SourceBuffer,
    type: E,
    callback: (event: SourceBufferEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof SourceBufferListEventMap>(
    target: SourceBufferList,
    type: E,
    callback: (event: SourceBufferListEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof SpeechSynthesisEventMap>(
    target: SpeechSynthesis,
    type: E,
    callback: (event: SpeechSynthesisEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof SpeechSynthesisUtteranceEventMap>(
    target: SpeechSynthesisUtterance,
    type: E,
    callback: (event: SpeechSynthesisUtteranceEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof TextTrackEventMap>(
    target: TextTrack,
    type: E,
    callback: (event: TextTrackEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof TextTrackCueEventMap>(
    target: TextTrackCue,
    type: E,
    callback: (event: TextTrackCueEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof TextTrackListEventMap>(
    target: TextTrackList,
    type: E,
    callback: (event: TextTrackListEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof VideoDecoderEventMap>(
    target: VideoDecoder,
    type: E,
    callback: (event: VideoDecoderEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof VideoEncoderEventMap>(
    target: VideoEncoder,
    type: E,
    callback: (event: VideoEncoderEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof VisualViewportEventMap>(
    target: VisualViewport,
    type: E,
    callback: (event: VisualViewportEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof WakeLockSentinelEventMap>(
    target: WakeLockSentinel,
    type: E,
    callback: (event: WakeLockSentinelEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof WebSocketEventMap>(
    target: WebSocket,
    type: E,
    callback: (event: WebSocketEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof WindowEventMap>(
    target: Window,
    type: E,
    callback: (event: WindowEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof WorkerEventMap>(
    target: Worker,
    type: E,
    callback: (event: WorkerEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof XMLHttpRequestEventMap>(
    target: XMLHttpRequest,
    type: E,
    callback: (event: XMLHttpRequestEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  <E extends keyof XMLHttpRequestEventTargetEventMap>(
    target: XMLHttpRequestEventTarget,
    type: E,
    callback: (event: XMLHttpRequestEventTargetEventMap[E]) => any,
    options?: boolean | AddEventListenerOptions
  ): void
  (
    target: EventTarget,
    type: string,
    callback: (event: Event) => any,
    options?: boolean | AddEventListenerOptions
  ): void
}
