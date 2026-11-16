import { z } from "zod";
import { LANGUAGES } from "@/lib/i18n/messages";

export const languageSchema = z.enum(LANGUAGES);
