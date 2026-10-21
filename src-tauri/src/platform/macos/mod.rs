//! macOS. Being ported (see `docs/macos-port.md`): the app builds and runs,
//! start-on-login works, and opening a file uses its default app, but
//! clipboard capture and following moved files are not available yet.

pub mod autostart;
pub mod capture;
pub mod open;
pub mod serve;
pub mod track;
pub mod window;

/// Runs the current thread at utility quality of service, which also
/// throttles its disk I/O, for background copies.
pub fn lower_priority() {
    // SAFETY: changes the QoS class of the calling thread only.
    unsafe {
        libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_UTILITY, 0);
    }
}
