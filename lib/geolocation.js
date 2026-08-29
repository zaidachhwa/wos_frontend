// Promise wrapper around the browser Geolocation API — used to prove
// presence at the office when submitting a follow-up (see FollowUpCard).
export const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location isn't available in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Location access denied — enable it in your browser settings and try again"));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("Couldn't get your location in time — try again"));
        } else {
          reject(new Error("Couldn't get your location — try again"));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
