import type { SmartReportContent, SourceBreakdown, InfluencerInfo, TimelinePoint, NarrativeInfo } from "@/hooks/useSmartReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

// ── palette ──
const C = {
  primary: "#1e1b4b",
  accent: "#6366f1",
  accentLight: "#818cf8",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
  cardBg: "#f8fafc",
  white: "#ffffff",
  textDark: "#111827",
  textGray: "#6b7280",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
};

// ── Wizr logo base64 (small PNG) ──
const LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG0AAAA8CAYAAABsKjQEAAAXv0lEQVR42u2ceXxd1XXvv2vvc+69kiwPYASGMJtJjLaMB8kgOxNDGpp+iPyShkKAQGiGpi/5JO8lL62s5r28Dslrk6a0BZqQFEjimwIlNKXwKVixJRss2cYYwwOb6cU4eJZ0Jd17z957vT/OvdZgG2ymYOL9n6Rzzj5n/fZa+7d+a23B4XF4HB6Hx+FxeBweh8fh8fqGKnLYCu9mgNsx2t4aKYeB/g2C0BrpVac0/LZ9tzkkwbqxKVZFeHHzwpAxT+t1Z9RrG1bbsPvzMAC95sST9Mbp1+qN02oBDlWPOyRBk1t6ExEU+Kipi6dAcqXk8ZLHv/qN0a3UZ79PueaLALS32t9C0FRATRtLbBtLbDtqoN2kv38LPKytzSpIcs0pH9IbTl+NcAOFJKDmVr3+tIf16lPPVpCqZ1W9TDoIevVpxwHNFBIHchEAGzr1UAQter1gtYHJIx7Q/F5/7wBUWllqATpZEEDCG37bxkZNX1o8UAR1iBjAIRRRs/ccSzHahmDCOcSmFqcgcrK2EvFanvlOjTSvAzBTBaCR9Zmj0eNdJEcGXMY4GQLd5clu7+asgfF3tvJItIAFoePNABDQT07/RybGN9KffEJu33jXWK/E0tgqbGhQyee9XjP9VnLmU5SDRwiUy2fIHS89r32NGfIbEgF9V4LWjpoOJFzII8fkmPplRa9QwokGG4NB8SiuDLITeBGx60RYYQMrOjnv6dGe2spS28kCD3LQxtIbm2Km9XpeOPXiYOROU+g7A7YN04hKB3stCL321KsxchsBCxqIbUQS/ll+sPHq8WH0XQVaFbB50WMXWld7d0TtezyDBBwQNDW+ChgRLIYYIQbAUXCCeRzRX4hy7zLOX119bhtq8yxW6Dhog6kiXDW9Xu7c2D+GDbY1xtSXLgcuDkirsTITryO+pARiY/DhYeD7lMoPy50vbXmXeVq7AWjmY8cYkjWGTINnMAGxlWfIGFMCmoZABRVBrCGHIYunAEg3Ru6woZTvZNb2NwrenplbiaQTp9ec+k9MjK+jGNLXcRqQcaSrChyAhu04vYvn3/MlOjv9Oz1UHhB7bONsSY05+G3LhAaXAhZX7h8HvAiICFiBSFJg1TMcEvqc4jHEzTbU3OzJrp8vT3yrlfXTU1LTEdpQezDsc0yu1VAxtmEDxVDa8zr7Xq6KC2mQqImmAp/kpBeiQyF/kwMOi/ScaYnXK0EqRn3dH6ZoSBlNbC11eAaHRPih1/K3u5m1KV0oS2yeRf7gn40IqF530hmYuBUfriQyH8Sp7nlnRckYwYVBlF6sWUfib5cfbupVRSo54KELWiuPRJ0sdC2y+i8jnfTlhD4nrztV2HtXUsQLEkXUExgeCOh3I3b8eScLC+niGE9U0gXTRl6grfK7PHme3BNaxxterz31S0T2WyQhDb2xMbhwH9b8sdz2zPPvNsovAJfyi0w/DU9bcicFyuHNV1JUFcqCZDM0kLC7L5jSp7vDfflWFuyZ67XZpkobeZNnkU8T7FbDhk6VPF4/eepaInM+ihL0JbZwhjywsaRtWLa2Cgs6w6HCHqNX38uWmDyL/GB09Bzrak7yDAdB3lTAFPWC2JgJ2YCjzPZ1gn1IgnkFFtOJuNHXv5+eSUWioyUKU4NSJ0RqJSoYp1seQV7Mg4d2Ix0dATpDqup3CiLLMHI+ILjwb/LAppK2NWYkv6EMndD5LlFEtnKUAAQvH4rI4im+aV6maBCQmInWMxQ8pX8V9J+OJXoozznl6nXzWXeKGOap6nzVMKMIJythqriMsRV9OODx+OGLeHKtt8OLu/2sB1PGm4ZLSV15I+BRDOgqBWHrUWGf4nJHqs8dkqCl4QiA9yrl16mg7DMUhog6G0hwDP/EEP56Gec/NrKPrj3HY69QCR9S9U02TMimdC8hkACeQEmrmZeAgKkxRPOsr/mPefS8bwWzHm5jiWXDIq2skkexYil78LJcQHVBZxjvYYdCiIxePTeT8F7WHFfUcI6nhKQSVpWl+crPB0HPQxAiEzPBeoaWK/5PupixFKCJnriW7BUK13vC+yy1GdUyniIJ/dW9TEbeQUTG5YeOQhJTnzEUvw483EibSj7N/OWHG1fqNaf+Eeg2ueO5jRWyEvZinb9/4gVMKD8jt2wZOuSISJrsip9ve37H+PqfOwa9kMYjRUNErQkkKMkBOaCiLqIuCrhBxX894u7vddLhYImdb878OEH+qyEzE8AzhKJuFEgHuDA0GHISpPR0l85sfK20YEQWI5ZbSPTa6Y3U2CcZdtdQ2HQnjY1WOjaUDxlP28pSSc0gFwrVnDM1foYjojI7bwE5L6JujmNQX42gKLiYyZFnqEdJPtXFzMdThaVnoSXzDRNqWtJQWfDpShIzklbIqPUVVCFUEvZ9zCMqRKJa3Dw6xxxRTFojGlI2OWbl3kJScdYvYAWUyyTPj2DDO7IKsF9DN7CtKkfNIP1GUdTFTI7K7H6gm6ZPC3qrEAv73bRVAR8zKXIM3t7Pywu6mPl4Ew9NapEnvmPJPSxkWhL6fYWZWhmRxvYKrYasRNTbNDlX3dd8QiSCPACwlKVjvk86O91owLQdoyD6yVO/pjeetg4jN1JwASMf1U+d9s96zfS54+tz72TQJM8i34ZaQc9MN//gYyZGCQMrC2z9aDtqPNl7HX07DLHd24iqYINlgnX0/WkX5127jksGm3l0Vg3HLIu07o8C5ZCGXbGv4qnBkAHkV84W3xcY/nlEvQEjStDR8xki4+gvGMJd44jUvseGPYujHpXTK7uaIBJRG12F6KcFlKWHBGipLbbWPnYUKkd7Si5iQsYx9FSJXR9exyWD99NrV3LOTtCfW2rRtDA5DrCc9fR/rouZ36iEw09Y6joN0bkJuxxg9hfqRifMSkBgQtmzbDnnX+EYvkGISobMHuDSfXaiCfjvLGPWllTDfPWyT9Xr5PZNX2WoeDKqT5KzDtVHGXIzGMx+WkGkE3cIgLY4XYFDGglmYpapUSDZrAx8uJeF29tYYk+hKaQKPj9VXCol7gHMBEuNLTNwUxez/g6ghdVfjai/Q3G1jiEvSDRqibzG3hFQtK4W9x5Q6eb82zxDHxLMsCFWBWeptQm7nyrDN9tRk+fAqLuAantjRu58aQuBB6iJ4sTrZ+W2Z9ey5J1ZHN0PaB0BVDqZszkQ2j3DPy2y++Ju5m+qCrmpUUQt2eWewVcMGQMExfiIeuvo/+JKLvzHCmB/ETHpm44hr3gd612GiDqb5m8a9i3HKwKxpyYDoq08klvBnP8MDF1lyBhBVBAC/nO9zBrakKZuB2HsDU7bMajcwa7S/4hP2rRG27DvVK3/VfK09KO74c9G524jyrtoCuA5hWbp7Yw0tyihXI6ZlHPs/qtuLvxrgBbp+YtYp3ylzC4naciSEdIQi5Ls9BQettR9VAniGd6Tk1U8IaRh1FpHWm5pYEEyl+6aLmbf3cyqmyMmfSb1dnviaOZ7wHnPnoT62bXA2kNaxqqWSKCNfRUoqzKXqDyo+LaICbkyu/91BU1fSfewx74W6RFfSdidCBqPJYWigpWA293NzLZm1l5piL4RUX+WYNA924ixliwlti+5lJkvncASW2koGk4DZ/InnsKVlglHC8P/vZH1d3ZydjJSIVDTCgaWVljxAs0jvg21VXAb2KZ5Fvn21vZoTs1O+4MHvuvSykGbto5joJ0sdK088ip2W0ADKOTZSptU5x17xRvrk3mDASBt8plL7/QMNc96yhsL6IWPM2P3PB77gwyTf5Qw6IRgxyfIivqICcZReLCb+y6HjjCdX2SP5j2XC/JB8GcqITbEz3v8/d3ck6+G7ovomWZpeG/ClrVdzHmyhd7/FTHxa4EynvIl3cx48NXrcfsr+cjbuH+NaKNvuqe9BuYBYCUzNzWz5ikluelx5uyew4o5lrrbHMN+X4CNWCkWkJ9BR7iUZ7IPcFqyEbkHuGffhoY5XHp0wHZFyMlC7UAzj19oGL7NUfhvKXssfgR4EBot4Jt57MpYjrzIm76yhFwmaPFXXci3Wlj9BSO5kw0Wp4NrupAfttB7s5A7TiklQhwHKW8Qkb4QVCMyIZjycO1R9gdD29znJWTqlMSPXvip0pI1mGIJZHOsted6hoOCEYNqsEUR+7IE1/VLLljzloXHAx0evfJR5jw1n3VTFP9jQTKBJAhmH4BpElEXO3ZvKrDtx6DyAJTHrnQ1gLZVyNJWlkonC13E6pkxU04usmUgx7T6Mq/8zjLmfruF3o2COQOYlV6/LS2IYopWa76g3ld6VIpuHj33A9+0WltriHEMbrqY1d1K5g8NWSCLZxhR1kY68X+ndKmWctiyeecr7vtZ5Bs1TIsCJQIOrZBfxZGlgaHw/J+q6FmRHvPHgW0YDOKjNL6oQ7E003tzNzM/D4s5WI97k5JG0Udpeip98fLNERNP9gw7wZjx2iCoRkyMA64v4D6+jksG06ZW0WZ6/rBVnvtZC6uuT714seQRn0d8miirRIRVCbuezjGtPmHX9kD4D1BRkScr73JcK+sndLLQgcoKmn5RZPNTgcSV2V4GxIj8g6LZMjtcka0OmOaEv1d8SOgrBYILlP5T4D5P2SX0FxP6HMiWPrZ6gRUl2fJkSbauTtix0zHgEnaXFO8GeX5dJS91ZXY6T2HYUXAJO3aU2TnoKDjHsM9w5GeaWXPpSF/M2wxaddJ5rPp4xOSPpS0JEo1P2A05I8R4Sg96huavYPaqRpZkOlnomum9KkvDzarJlTFTb2tm9e+mH7TEjmaznczaXqY8H7jSMzBrBbPXg6io/royUV2gWA/QSD5O7zP3WnIRqaZpjWZbKypMJGgEUms1fp/iDYi1xJHC3YorGmwEVK4ju5HLyrvIvn+Z/st5aPg9IQ6pkG4sqFX085WQWSMQKSoxkyKFmy16ZUR9BCSK90aY93rYrnkzNtQ8i7WVp6caMt9JNcSxz1XwhloNuAcUmbGccy5Zwez17ag5imohUuYHXEjo36UohjBvNEMdWY0qq5iz4xGOv3sFLS82siRTud9UCI6WyQSA6rMF+alnMEjlGZWWiYoQkJblAkn1Wpsw4Bz+7oDU6l45umgbZzvoCAG+a6mbGnDlmEmRp3jzCpp+WZGU3BjahdQ5IymxTPdni1SE6jdLMD5wL0vb6xIKfx4x4aj99JCoISPgnuvi3Meb6ImpKPAjwrTe5RkOWaZO8QwWA/KzKj0GSGm+7GmKTWl3uzl7j5qi0ypzDQiF/hHtUaWLGesCyRpLrVTUFwOKEIsQVUUPo+DTa8qPrmLOr5Wodm9hRaXSndaWYdLvOvoSS03W0b85xny9kfWZsaxcooQ+DHzWBvsjRwFBYqVMCPrQaHH+bQGtSqub6Z1lyV7n6Pd7h8UUs0AJhYvbUNtLk6syz5SWq6yg6ZeOvjnAZx0Ds7tp6kkNhLbySNRC73WtbOpspvd7IJp+aEfIs8g30RMr2lgx/osraR6uFHG1ul+C+amQqQqrwVBDIHlC8ZtS8qEVF7AI8hNQMYRxEUMNLJZW1kw2RH/jKYW0R9I4wX+qkxm7N6StEqpjGHNAiLNKQAneUmc8g1/tpmnF62kVfEOgNdJWWSH6TSEruh+5TxATKKohPutl1p45krSPVl9UVtK8eikn37yS5idG500lsrHClwR7MfDc2MRfJYucL0SnVuZfmbYspF1cnRVPNdh/cfSXJH1myVITBPm2ondZJniFkiDiGBgCva8yt6sUY52CEySkUcX9T0vtsYFSWRA8Q2WQr7RI79IF8vyyFtOzSER3CsYJJGCdSvJi2hcjQQke5JyxNnwbQGtjie1AQgs9cy01H/AUwqsp9pXQYxX3GRCt7lWjgWtHTSsapefcqvRfWEnz8G6yM0psPrqbpv9T9dD0GaKCXh9RZzxDGMy9Y0OOhHbULOe858CvzjItjphYEyiaMrn7gX9PyUcul6XBgi7rYtZLFdUzl2FKFFGXyzAlAo1b6P1wlmmfFYSYSbmI+ihmSm2GaQsz2tCa1ePmC2Y6KrmYKZEhV1PDCZHCz4Hbshwbg7c5jv9EM71f7EDC2AX8luZpbdVq8U1p/lPai4CMk32toxAMuevm0fW3nbQ8PT40VKSd0LmPOlEl7GytKgnpvQvdXHqnC9HVitdAed1xPLcSVPKjSkUbyKdNJdb+pQt9lwQtorhXVtG0o4mex4Wt90FU5xk0it5aEf/ReO02lxT+zjFQVJJYje4EOS9o4ZaEgaSSSiqAE6NKEKWc9SH0CmoTdv6NSrHk2J0RDcsEszxhxwkqJS3xCoI0z9aVt+WZ238wiszrlLHSCWazcmJEvMkQT1USfa1eDgUfUWsdxZUxuy5KNbgRZeW156yG0nbTVsnhWlj7sCFeKMQ4Bv6gm6Y7ql3Rv1mZ6uBs+ZZ7WnoKFJ8lmiXUTnUMHVATq4B1DPqYSXMd+qMO5PfT/WdfRt531SFtOCLkkdDM2r+11CxUHI7+x2MGfgJqOscUZEffn3ppO2rupzdXE8v05UnTOlBp5Ml4A2cnc1mRW8m8YvWk62xWTryMOYUN5GUz59aWGCwmRJljedkNc0IM21yBenMKz5XyLPIpqz0qV6BYqolCM660rkzsPdHwBAa0gW26laNqOllYSEUAKbwtgnHVyPNN7xdtmPxXCX1hbH+/hspRJ6l2cI3zOBczMXIM3+sZuH4lzTurBw0r3jfq4Era2tjKUlNVxxtZkpnC6d+z1N4QGE4EC/i5yzh/9d5sLF3JLab3c2T0PsrMNUZfMNbs9Il+0Gfk3+KiZMqRb4jQKARzemTMWq9uKshwUG3MhPiu0sRhYwrR5TZkuoJxl2vwj4oxjRrMs6BnxHHoKQdzosWUvLppmGiTBD2FWFdIIq1qzWob/HFOwi4T5Fw1pleDnxlZ07MsmbV6fBPSW8Ye09ZBY0CdVhiWpm1sJmZiFFFrFfXji5sCUUKfj8h9JKJ+VTNr/0u17JG+uGgFrUpeJqH6t2aeWHgEZ3VZam4IDCeGXOwZvHbfgKXF0CZ6alU5znimAqd6pCnxTA7olNhxLEBWwiAm2oboVnGyDR8Pi49ftmK2FfDluFxfZ63JJRzx64DuDGS2qJHnI2S7GI70ypGiejz4ycaYZ0VkKI5MyeKCRNIfiy2qmII15ogk+B+Dw0j8jGqof1sE406Wpq0GYdU9Cf1fz3Dk5LT/0aBpeeSZQOl2hQuyTF3kGCQwrGkfiRpBJFUe+r0le0pEzU/m88SXlXU/NugjhvBcJ/f2Q0f4AGvrCpjjDaFFMB8D3l9RNYBIyvRfs5I5d7bySJTfzz6WgROslR0hcJKIWyNEjap6vBjTHzQcF6zkrLEZvBSMmomJ1UbwsRgzgMrxWZisUVLEIza39Sgpm/pg/ekGLTucEYwElTpjxQumDpNM9oHNXkMuSGQkhJOc8V7UJMH7EFmzQDBbjep0L+b/vo31tNQg81nZKNRfj4QpqvIC+K4JbF7+AJeX0kLo2psM9lpgtqWWVBkvontknrRIbclFhgyVI8HbJD23HYCJCkdH1EZpcuqw1BAoPRko3tTFrOWvtSd+gLV1D3HP8Gwum+CJ3BFE0ketfYzT++fSfUQ2mz0iiC+ZYjzgM3os5cEtUluTywz5cjHOHNOVXPAUwMWZ1WeE8tCvydRNK5fLvzKEBCAh4yZMYNK2wnP9J3CBDE8arCn0+cG6jEzPlPXlMklDhnjrUI3UueGkEMeZk+uTXz/dFx972oSE5x/igsG3swi6X+aTGnLkaNJ81s4B+xHwlyl6btoGx57+/Ar7dIpagzXpPmVGvWj1sEX5RYV/KPLCd3u5YqjaCc1v0XgzDlSY0SX5tHTfFsayvbFGnc/6RiXMhTAP5FzwJykcaYmjVEcVUq9KULQA5v+B9AD3K/3/3s38Adi7g/gAFxkjDVbVw/2jx2KBxTpuXwwj1ebFOnLNngUr1YgxKnro3tePnqMjMCIi6NsM2gHWAlCzlKVmX2GsmafqwTVY3JFKqMcSe6/liHh3TO6Vizh9y2hwqrT/nZl3HRKe9sa880D/l0i1NPPbDNZvGLR9qh2Vc9RViSxPI23akZbjDzqEHB6Hx+FxeBweh8fhcXgcHm/B+P+zbAc3NtXzRwAAAABJRU5ErkJggg==";

function sentColor(s: string) {
  if (s === "positivo") return C.positive;
  if (s === "negativo") return C.negative;
  return C.neutral;
}

function sentLabel(s: string) {
  if (s === "positivo") return "Positivo";
  if (s === "negativo") return "Negativo";
  if (s === "mixto") return "Mixto";
  return "Neutral";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("es-MX");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── badge detection ──
function detectBadge(report: SmartReportContent, isSummary: boolean): { label: string; bg: string } {
  if (isSummary) return { label: "RESUMEN", bg: "#3b82f6" };
  const total = report.metrics.totalMentions || 1;
  const negPct = (report.metrics.negativeCount / total) * 100;
  if (negPct > 60) return { label: "CRISIS", bg: C.negative };
  if (report.entityComparison) return { label: "COMPARATIVO", bg: "#0891b2" };
  return { label: "BRIEF", bg: "#3b82f6" };
}

// ── section wrapper ──
function section(title: string, body: string, headerBg = C.accent): string {
  return `<section style="margin-bottom:18px;border-radius:6px;overflow:hidden;border:1px solid ${C.border};">
    <div style="background:${headerBg};color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:9px 16px;">${escapeHtml(title)}</div>
    <div style="padding:16px 18px;background:${C.white};">${body}</div>
  </section>`;
}

// ── charts (HTML/CSS only) ──

function chartPlatformBars(sources: SourceBreakdown[]): string {
  const data = sources.slice(0, 8);
  if (!data.length) return "";
  const max = Math.max(...data.map(s => s.count), 1);
  const rows = data.map((s, i) => {
    const pct = (s.count / max) * 100;
    const color = i < 3 ? C.accent : C.neutral;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
      <span style="min-width:100px;font-size:8.5px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.source)}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:16px;overflow:hidden;">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:3px;transition:width 0.3s;"></div>
      </div>
      <span style="font-size:9px;font-weight:700;min-width:28px;color:${C.textDark};">${s.count}</span>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:700;margin-bottom:8px;text-align:center;color:${C.textDark};">Menciones por Plataforma</div>${rows}</div>`;
}

function chartDailyBars(timeline: TimelinePoint[]): string {
  const data = timeline.slice(0, 14);
  if (!data.length) return "";
  const max = Math.max(...data.map(t => t.count), 1);
  const maxIdx = data.indexOf(data.reduce((a, b) => a.count > b.count ? a : b));
  const bars = data.map((t, i) => {
    const pct = (t.count / max) * 100;
    const color = i === maxIdx ? C.negative : C.accent;
    const dayLabel = t.date.slice(5);
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      <span style="font-size:7.5px;font-weight:600;margin-bottom:2px;color:${C.textDark};">${t.count}</span>
      <div style="width:70%;background:${color};border-radius:3px 3px 0 0;height:${Math.max(pct * 0.55, 3)}px;"></div>
      <span style="font-size:7px;color:${C.textGray};margin-top:3px;">${dayLabel}</span>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:700;margin-bottom:8px;text-align:center;color:${C.textDark};">Evolución Diaria</div>
    <div style="display:flex;align-items:flex-end;height:70px;gap:2px;">${bars}</div></div>`;
}

function chartSentimentByPlatform(sources: SourceBreakdown[]): string {
  const data = sources.filter(s => s.count > 0).slice(0, 8);
  if (!data.length) return "";
  const rows = data.map(s => {
    const total = s.count || 1;
    const posPct = (s.positive / total) * 100;
    const neuPct = (s.neutral / total) * 100;
    const negPct = (s.negative / total) * 100;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
      <span style="min-width:100px;font-size:8.5px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.source)}</span>
      <div style="flex:1;display:flex;height:16px;border-radius:3px;overflow:hidden;">
        <div style="width:${posPct}%;background:${C.positive};"></div>
        <div style="width:${neuPct}%;background:${C.neutral};"></div>
        <div style="width:${negPct}%;background:${C.negative};"></div>
      </div>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:700;margin-bottom:8px;text-align:center;color:${C.textDark};">Sentimiento por Plataforma</div>${rows}</div>`;
}

function chartTopInfluencersBars(influencers: InfluencerInfo[]): string {
  const data = influencers.slice(0, 6);
  if (!data.length) return "";
  const maxReach = Math.max(...data.map(inf => parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions), 1);
  const rows = data.map(inf => {
    const val = parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions;
    const pct = (val / maxReach) * 100;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
      <span style="min-width:100px;font-size:8.5px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(inf.name || inf.username)}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:16px;overflow:hidden;">
        <div style="width:${pct}%;background:${sentColor(inf.sentiment)};height:100%;border-radius:3px;"></div>
      </div>
      <span style="font-size:9px;font-weight:700;min-width:32px;color:${C.textDark};">${fmtNum(val)}</span>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:700;margin-bottom:8px;text-align:center;color:${C.textDark};">Top Influenciadores</div>${rows}</div>`;
}

// ── page header for continuation pages ──
function pageHeader(): string {
  return `<div class="page-header" style="display:none;align-items:center;justify-content:space-between;padding:8px 24px;border-bottom:1px solid ${C.border};margin-bottom:12px;">
    <img src="${LOGO_B64}" alt="Wizr" style="height:22px;">
    <span style="font-size:8px;color:${C.textGray};letter-spacing:0.5px;">WIZR · ANÁLISIS ESTRATÉGICO</span>
  </div>`;
}

// ── main builder ──

export function buildReportHTML(
  report: SmartReportContent,
  projectName: string,
  dateRange: DateRange,
  isSummary: boolean,
): string {
  const badge = detectBadge(report, isSummary);
  const generatedDate = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });
  const total = report.metrics.totalMentions || 1;
  const negPct = ((report.metrics.negativeCount / total) * 100).toFixed(1);
  const posPct = ((report.metrics.positiveCount / total) * 100).toFixed(1);

  const summaryFontSize = isSummary ? "13px" : "12px";
  const summaryLineHeight = isSummary ? "1.8" : "1.7";
  const sectionSeparator = isSummary
    ? `<hr style="border:none;border-top:1px solid ${C.border};margin:20px 0;">`
    : "";

  // ── HEADER ──
  const header = `<div style="background:${C.primary};padding:24px 28px;display:flex;align-items:center;justify-content:space-between;border-radius:0;">
    <div style="display:flex;align-items:center;gap:14px;">
      <img src="${LOGO_B64}" alt="Wizr" style="height:30px;">
    </div>
    <div style="text-align:right;">
      <span style="background:${badge.bg};color:#fff;font-size:9px;font-weight:700;padding:4px 12px;border-radius:3px;text-transform:uppercase;letter-spacing:0.8px;">${badge.label}</span>
      <div style="color:#fff;font-size:14px;font-weight:600;margin-top:8px;max-width:460px;">${escapeHtml(report.title)}</div>
      <div style="color:${C.neutral};font-size:10px;margin-top:4px;">${escapeHtml(dateRange.label)} · ${generatedDate}</div>
    </div>
  </div>`;

  // ── METRICS ROW ──
  const metricCell = (value: string, label: string, color = C.textDark) =>
    `<div style="flex:1;text-align:center;padding:14px 8px;">
      <div style="font-size:20px;font-weight:700;color:${color};line-height:1.2;">${value}</div>
      <div style="font-size:9.5px;color:${C.textGray};margin-top:4px;text-transform:uppercase;letter-spacing:0.3px;">${label}</div>
    </div>`;
  const sep = `<div style="width:1px;background:${C.border};margin:8px 0;"></div>`;
  const metricsRow = `<div style="display:flex;align-items:stretch;border:1px solid ${C.border};border-radius:6px;margin:16px 24px;background:${C.white};">
    ${metricCell(fmtNum(report.metrics.estimatedImpressions), "Impresiones Est.")}${sep}
    ${metricCell(report.metrics.totalMentions.toString(), "Total Menciones")}${sep}
    ${metricCell(fmtNum(report.metrics.estimatedReach), "Alcance Est.")}${sep}
    ${metricCell(negPct + "%", "% Negativo", C.negative)}${sep}
    ${metricCell(posPct + "%", "% Positivo", C.positive)}
  </div>`;

  // ── SENTIMENT BAR ──
  const posW = report.metrics.positiveCount / total * 100;
  const neuW = report.metrics.neutralCount / total * 100;
  const negW = report.metrics.negativeCount / total * 100;
  const sentBar = `<div style="padding:12px 24px 16px;">
    <div style="display:flex;height:24px;border-radius:12px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1);">
      <div style="width:${posW}%;background:${C.positive};"></div>
      <div style="width:${neuW}%;background:${C.neutral};"></div>
      <div style="width:${negW}%;background:${C.negative};"></div>
    </div>
    <div style="display:flex;gap:20px;margin-top:8px;font-size:10px;color:${C.textGray};">
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.positive};display:inline-block;"></span>Positivo ${posW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.neutral};display:inline-block;"></span>Neutral ${neuW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.negative};display:inline-block;"></span>Negativo ${negW.toFixed(0)}%</span>
    </div>
  </div>`;

  // ── SECTIONS ──
  const sections: string[] = [];

  // 1. Executive Summary
  sections.push(section("Resumen Ejecutivo",
    `<p style="font-size:${summaryFontSize};line-height:${summaryLineHeight};color:${C.textDark};margin:0;">${escapeHtml(report.summary)}</p>`
  ));

  // 2. Data Visualization (full only)
  if (!isSummary) {
    const charts = [
      chartPlatformBars(report.sourceBreakdown),
      chartDailyBars(report.timeline),
      chartSentimentByPlatform(report.sourceBreakdown),
      chartTopInfluencersBars(report.influencers),
    ].filter(Boolean);
    if (charts.length > 0) {
      const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">${charts.join("")}</div>`;
      sections.push(section("Visualización de Datos", grid));
    }
  }

  if (isSummary) sections.push(sectionSeparator);

  // 3. Key Findings
  const findings = isSummary ? report.keyFindings.slice(0, 3) : report.keyFindings;
  const findingsHtml = findings.map((f, i) => `<div class="finding-item" style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;">
    <div style="min-width:26px;height:26px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</div>
    <p style="font-size:11.5px;line-height:1.65;color:${C.textDark};margin:0;">${escapeHtml(f)}</p>
  </div>`).join("");
  sections.push(section("Hallazgos Clave", findingsHtml));

  if (isSummary) sections.push(sectionSeparator);

  // 4. Influencers table
  const infs = isSummary ? report.influencers.slice(0, 5) : report.influencers;
  if (infs.length > 0) {
    const headerRow = `<tr style="background:${C.primary};">
      <th style="padding:8px 12px;font-size:9px;text-align:left;color:#fff;font-weight:600;">#</th>
      <th style="padding:8px 12px;font-size:9px;text-align:left;color:#fff;font-weight:600;">Perfil</th>
      <th style="padding:8px 12px;font-size:9px;text-align:left;color:#fff;font-weight:600;">Red</th>
      <th style="padding:8px 12px;font-size:9px;text-align:center;color:#fff;font-weight:600;">Menciones</th>
      <th style="padding:8px 12px;font-size:9px;text-align:center;color:#fff;font-weight:600;">Sentimiento</th>
      <th style="padding:8px 12px;font-size:9px;text-align:right;color:#fff;font-weight:600;">Interacciones</th>
    </tr>`;
    const rows = infs.map((inf, i) => {
      const bg = i % 2 === 0 ? C.white : C.cardBg;
      return `<tr style="background:${bg};">
        <td style="padding:7px 12px;font-size:10px;color:${C.textGray};">${i + 1}</td>
        <td style="padding:7px 12px;font-size:10px;font-weight:600;color:${C.textDark};">${escapeHtml(inf.name || inf.username)}</td>
        <td style="padding:7px 12px;font-size:10px;color:${C.textGray};">${escapeHtml(inf.platform)}</td>
        <td style="padding:7px 12px;font-size:10px;text-align:center;color:${C.textDark};">${inf.mentions}</td>
        <td style="padding:7px 12px;font-size:10px;text-align:center;color:${sentColor(inf.sentiment)};font-weight:600;">${sentLabel(inf.sentiment)}</td>
        <td style="padding:7px 12px;font-size:10px;text-align:right;font-weight:600;color:${C.textDark};">${escapeHtml(inf.reach || "—")}</td>
      </tr>`;
    }).join("");
    const table = `<table style="width:100%;border-collapse:collapse;">${headerRow}${rows}</table>`;
    sections.push(section("Influenciadores", table));
  }

  if (isSummary) sections.push(sectionSeparator);

  // 5. Narratives (full only)
  if (!isSummary && report.narratives.length > 0) {
    const narrativesHtml = report.narratives.map(n =>
      `<div class="narrative-card" style="border:1px solid ${C.border};border-radius:6px;padding:12px 14px;margin-bottom:10px;background:${C.cardBg};">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:700;color:${C.textDark};">${escapeHtml(n.narrative)}</span>
          <span style="background:${sentColor(n.sentiment)}18;color:${sentColor(n.sentiment)};font-size:8.5px;padding:3px 10px;border-radius:10px;font-weight:700;border:1px solid ${sentColor(n.sentiment)}30;">${sentLabel(n.sentiment)}</span>
          <span style="font-size:9px;color:${C.textGray};">${n.mentions} menciones · ${n.trend === "creciente" ? "↑" : n.trend === "decreciente" ? "↓" : "→"} ${n.trend}</span>
        </div>
        <p style="font-size:11px;color:${C.textGray};line-height:1.6;margin:0;">${escapeHtml(n.description)}</p>
      </div>`
    ).join("");
    sections.push(section("Principales Narrativas", narrativesHtml));
  }

  // 6. Recommendations
  const recs = isSummary ? report.recommendations.slice(0, 2) : report.recommendations;
  const recsHtml = recs.map((r, i) => `<div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;">
    <div style="min-width:26px;height:26px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</div>
    <p style="font-size:11.5px;line-height:1.65;color:${C.textDark};margin:0;">${escapeHtml(r)}</p>
  </div>`).join("");
  sections.push(section("Recomendaciones", recsHtml));

  if (isSummary) sections.push(sectionSeparator);

  // 7. Conclusions
  if (report.conclusions && report.conclusions.length > 0) {
    const concs = isSummary ? report.conclusions.slice(0, 2) : report.conclusions;
    const bullets = concs.map(c =>
      `<li style="margin-bottom:8px;font-size:11.5px;line-height:1.65;color:${C.textDark};padding-left:8px;">${escapeHtml(c)}</li>`
    ).join("");
    const body = `<ul style="margin:0;padding-left:16px;list-style:none;">${bullets.replace(/<li /g, `<li style="position:relative;padding-left:16px;" `).replace(/<li style="/g, `<li style="position:relative;padding-left:16px;`)}
    </ul>`.replace(/position:relative;padding-left:16px;position:relative;padding-left:16px;/g, "position:relative;padding-left:16px;");
    // Custom bullet points
    const bodyWithBullets = concs.map(c =>
      `<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
        <span style="min-width:8px;height:8px;border-radius:50%;background:${C.accent};display:block;margin-top:5px;flex-shrink:0;"></span>
        <p style="font-size:11.5px;line-height:1.65;color:${C.textDark};margin:0;">${escapeHtml(c)}</p>
      </div>`
    ).join("");
    sections.push(section("Conclusiones", bodyWithBullets, C.primary));
  }

  // ── FOOTER ──
  const footer = `<div style="background:${C.primary};padding:14px 28px;display:flex;align-items:center;justify-content:space-between;margin-top:20px;">
    <img src="${LOGO_B64}" alt="Wizr" style="height:18px;opacity:0.7;">
    <span style="color:${C.neutral};font-size:9px;letter-spacing:0.3px;">Generado con Wizr · ${generatedDate}</span>
  </div>`;

  // ── FULL HTML ──
  // The @page { margin: 0 } removes browser-generated headers/footers (URL, date, page numbers)
  // We use our own margins via padding on the body content
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(report.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
  font-family:'Inter',sans-serif;
  font-size:12px;
  color:${C.textDark};
  background:#fff;
  width:794px;
  margin:0 auto;
}
@page{
  margin:0;
  size:A4;
}
@media print{
  body{width:100%;margin:0;}
  section{break-inside:avoid;}
  table{break-inside:avoid;}
  .narrative-card{break-inside:avoid;}
  .finding-item{break-inside:avoid;}
  .page-header{display:flex !important;}
}
@media screen{
  body{padding-bottom:40px;}
}
</style>
</head>
<body>
${header}
${metricsRow}
${sentBar}
<div style="padding:0 24px 16px;">
${sections.join("\n")}
</div>
${footer}
</body>
</html>`;
}
