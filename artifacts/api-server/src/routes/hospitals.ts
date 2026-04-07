import { Router, type IRouter } from "express";
import { GetNearbyHospitalsBody, GetNearbyHospitalsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/hospitals/nearby", async (req, res): Promise<void> => {
  const parsed = GetNearbyHospitalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { latitude, longitude } = parsed.data;

  req.log.info({ latitude, longitude }, "Getting nearby hospitals");

  const hospitals = [
    {
      name: "City General Hospital",
      address: "123 Main Street, City Center",
      phone: "555-0100",
      latitude: latitude + 0.012,
      longitude: longitude + 0.008,
    },
    {
      name: "St. Mary Medical Center",
      address: "456 Oak Avenue, Westside",
      phone: "555-0200",
      latitude: latitude - 0.018,
      longitude: longitude + 0.015,
    },
    {
      name: "Memorial Emergency Hospital",
      address: "789 Park Blvd, North District",
      phone: "555-0300",
      latitude: latitude + 0.025,
      longitude: longitude - 0.01,
    },
    {
      name: "Regional Trauma Center",
      address: "321 Health Way, East Side",
      phone: "555-0400",
      latitude: latitude - 0.005,
      longitude: longitude + 0.022,
    },
  ].map((h) => {
    const dlat = h.latitude - latitude;
    const dlng = h.longitude - longitude;
    const distKm =
      Math.round(
        Math.sqrt(Math.pow(dlat * 111, 2) + Math.pow(dlng * 111, 2)) * 10
      ) / 10;
    return {
      name: h.name,
      address: h.address,
      distance: `${distKm} km away`,
      phone: h.phone,
      latitude: h.latitude,
      longitude: h.longitude,
    };
  });

  const validated = GetNearbyHospitalsResponse.safeParse({ hospitals });
  if (!validated.success) {
    req.log.warn({ error: validated.error.message }, "Response validation warning");
    res.json({ hospitals });
    return;
  }

  res.json(validated.data);
});

export default router;
