//! Linux: X11 for the clipboard, GIO for applications, inotify for moved
//! files and the XDG autostart spec.

pub mod autostart;
pub mod capture;
pub mod open;
pub mod serve;
pub mod track;
pub mod window;

/// Runs the current thread at idle I/O priority and a lower CPU priority,
/// for background copies that must not slow the system down.
pub fn lower_priority() {
    const IOPRIO_WHO_PROCESS: libc::c_long = 1;
    const IOPRIO_CLASS_IDLE: libc::c_long = 3;
    const IOPRIO_CLASS_SHIFT: libc::c_long = 13;
    // SAFETY: plain syscalls on the current thread with valid arguments.
    unsafe {
        libc::syscall(
            libc::SYS_ioprio_set,
            IOPRIO_WHO_PROCESS,
            0,
            IOPRIO_CLASS_IDLE << IOPRIO_CLASS_SHIFT,
        );
        libc::nice(10);
    }
}
