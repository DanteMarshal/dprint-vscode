export class NotificationThrottle {
  #hasNotified = false;

  shouldNotify() {
    if (this.#hasNotified) {
      return false;
    }
    this.#hasNotified = true;
    return true;
  }
}
