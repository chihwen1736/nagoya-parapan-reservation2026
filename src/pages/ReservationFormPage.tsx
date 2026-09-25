import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { checkCapacity } from "@/lib/capacity";
import { isDateInEventRange, todayInEventRangeOrStart } from "@/lib/time";
import { ReservationSummary } from "@/components/ReservationSummary";
import {
  EVENT_END_DATE,
  EVENT_START_DATE,
  FITNESS_BRANCH_LABELS,
  FITNESS_BRANCH_OPTIONS,
  MEAL_SERVE_METHOD_LABELS,
  MEAL_TYPE_LABELS,
  Reservation,
  ReservationDraft,
  SERVICE_LABELS,
  SERVICE_OPTIONS,
  SPORTS_SCIENCE_BRANCH_LABELS,
  SPORTS_SCIENCE_BRANCH_OPTIONS,
  TEAM_LABELS,
  TEAM_OPTIONS,
  THERAPY_BRANCH_LABELS,
  THERAPY_BRANCH_OPTIONS,
  TRANSPORT_LOCATION_LABELS,
  TRANSPORT_LOCATION_OPTIONS,
  emptyDraft,
  emptyFitnessFields,
  emptyMealFields,
  emptySportsScienceFields,
  emptyTherapyFields,
  emptyTransportFields,
} from "@/types";

function reservationToDraft(r: Reservation): ReservationDraft {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, reservation_no, created_at, updated_at, ...rest } = r;
  return rest;
}

type Step = "form" | "confirm";

export default function ReservationFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { reservations, getReservation, draftReservation, setDraftReservation, addReservation, updateReservation, previewNextReservationNo } =
    useData();

  const today = todayInEventRangeOrStart(new Date().toISOString().slice(0, 10));

  const [draft, setDraft] = useState<ReservationDraft>(() => {
    if (isEditing && id) {
      const existing = getReservation(id);
      if (existing) return reservationToDraft(existing);
    }
    if (draftReservation) return draftReservation;
    return emptyDraft(today);
  });
  const [step, setStep] = useState<Step>("form");
  const [attempted, setAttempted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // 複製功能的暫存草稿只使用一次，讀取後立即清除，避免下次新增又被誤用
  useEffect(() => {
    if (!isEditing && draftReservation) {
      setDraftReservation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditing && id) {
      const existing = getReservation(id);
      if (existing) setDraft(reservationToDraft(existing));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function patch(p: Partial<ReservationDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  function onServiceChange(service: ReservationDraft["service"]) {
    setDraft((prev) => {
      const base: ReservationDraft = { ...prev, service, meal: undefined, transport: undefined, therapy: undefined, fitness: undefined, sportsScience: undefined };
      if (service === "meal") return { ...base, meal: emptyMealFields(), end_time: "" };
      if (service === "transport") {
        const t = emptyTransportFields();
        return { ...base, transport: t, end_time: "", headcount: t.passenger_count };
      }
      if (service === "therapy") return { ...base, therapy: emptyTherapyFields() };
      if (service === "fitness") return { ...base, fitness: emptyFitnessFields() };
      if (service === "sports_science") return { ...base, sportsScience: emptySportsScienceFields() };
      return base;
    });
  }

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const mealMismatch = draft.service === "meal" && draft.meal ? draft.meal.meal_count !== draft.headcount : false;

  const capacityResult = useMemo(
    () => checkCapacity(draft, reservations, isEditing ? id : undefined),
    [draft, reservations, isEditing, id]
  );

  const nextNo = useMemo(() => previewNextReservationNo(draft.reservation_date), [draft.reservation_date, previewNextReservationNo]);

  function goToConfirm() {
    setAttempted(true);
    if (errors.length > 0) return;
    setStep("confirm");
  }

  function confirmSave() {
    if (errors.length > 0 || capacityResult.exceeded) return;
    if (isEditing && id) {
      updateReservation(id, draft);
      setSuccessMsg("已儲存修改。");
    } else {
      const created = addReservation(draft);
      setSuccessMsg(`已新增預約，預約單編號：${created.reservation_no}`);
    }
    setStep("form");
    if (!isEditing) {
      setDraft(emptyDraft(draft.reservation_date));
      setAttempted(false);
    } else {
      navigate("/overview");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg">{isEditing ? "修改預約" : "新增預約"}</h2>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <div className="flex gap-3">
            <button onClick={() => setSuccessMsg("")} className="text-xs underline">
              繼續新增
            </button>
            <button onClick={() => navigate("/overview")} className="text-xs underline">
              前往每日總覽
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="bg-white rounded-xl shadow p-4 space-y-5">
          <FieldGroup label="預約日期" required>
            <input
              type="date"
              value={draft.reservation_date}
              min={EVENT_START_DATE}
              max={EVENT_END_DATE}
              onChange={(e) => patch({ reservation_date: e.target.value })}
              className="border rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-400 mt-1">
              開放預約日期為 {EVENT_START_DATE} ～ {EVENT_END_DATE}。下一個預約單編號預覽：<span className="font-mono">{nextNo}</span>
            </p>
          </FieldGroup>

          <FieldGroup label="代表隊" required>
            <select value={draft.team} onChange={(e) => patch({ team: e.target.value as ReservationDraft["team"] })} className="border rounded-lg px-3 py-2 w-full max-w-xs">
              {TEAM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TEAM_LABELS[t]}
                </option>
              ))}
            </select>
            {draft.team === "other" && (
              <input
                value={draft.team_other_text}
                onChange={(e) => patch({ team_other_text: e.target.value })}
                placeholder="請輸入代表隊或單位名稱"
                className="border rounded-lg px-3 py-2 w-full max-w-xs mt-2"
              />
            )}
          </FieldGroup>

          <FieldGroup label="服務項目" required>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onServiceChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    draft.service === s ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:border-brand-400"
                  }`}
                >
                  {SERVICE_LABELS[s]}
                </button>
              ))}
            </div>
          </FieldGroup>

          {draft.service !== "transport" && (
            <FieldGroup label="預約人數" required>
              <input
                type="number"
                min={1}
                step={1}
                value={draft.headcount}
                onChange={(e) => patch({ headcount: Math.trunc(Number(e.target.value)) || 0 })}
                className="border rounded-lg px-3 py-2 w-32"
              />
            </FieldGroup>
          )}

          {draft.service === "meal" && draft.meal && (
            <MealFieldsBlock draft={draft} patch={patch} mealMismatch={mealMismatch} />
          )}
          {draft.service === "transport" && draft.transport && <TransportFieldsBlock draft={draft} patch={patch} />}
          {draft.service === "therapy" && draft.therapy && <TherapyFieldsBlock draft={draft} patch={patch} />}
          {draft.service === "fitness" && draft.fitness && <FitnessFieldsBlock draft={draft} patch={patch} />}
          {draft.service === "sports_science" && draft.sportsScience && <SportsScienceFieldsBlock draft={draft} patch={patch} />}

          <FieldGroup label="聯絡人">
            <input value={draft.contact_person} onChange={(e) => patch({ contact_person: e.target.value })} className="border rounded-lg px-3 py-2 w-full max-w-xs" />
          </FieldGroup>
          <FieldGroup label="聯絡方式">
            <input value={draft.contact_method} onChange={(e) => patch({ contact_method: e.target.value })} className="border rounded-lg px-3 py-2 w-full max-w-xs" />
          </FieldGroup>
          <FieldGroup label="備註">
            <textarea value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} className="border rounded-lg px-3 py-2 w-full" rows={2} />
          </FieldGroup>

          {attempted && errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">請修正以下問題後再繼續：</p>
              <ul className="list-disc list-inside space-y-0.5">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={goToConfirm} className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm">
              下一步：確認
            </button>
            {isEditing && (
              <button onClick={() => navigate("/overview")} className="border rounded-lg px-4 py-2 text-sm">
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="bg-white rounded-xl shadow p-4 space-y-4">
          <h3 className="font-semibold">請確認以下預約內容</h3>
          <ReservationSummary data={draft} reservationNo={isEditing ? getReservation(id!)?.reservation_no : nextNo} />

          {mealMismatch && (
            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              提醒：餐食份數（{draft.meal?.meal_count}）與預約人數（{draft.headcount}）不一致，仍可繼續儲存。
            </p>
          )}

          {capacityResult.isCapacityLimited && (
            <div
              className={`rounded-lg p-3 text-sm border ${
                capacityResult.exceeded ? "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              <p className="font-medium">
                同一時段容量：{capacityResult.capacity ?? "無上限"} 人，這筆預約時間範圍內最高同時使用人數為 {capacityResult.maxConcurrentHeadcount} 人
                {capacityResult.exceeded ? "（超過容量！）" : ""}
              </p>
              {capacityResult.overlapping.length > 0 && (
                <>
                  <p className="mt-2 text-xs text-gray-500">時間有交集的既有預約：</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {capacityResult.overlapping.map((r) => (
                      <li key={r.id}>
                        {r.reservation_no}｜{r.start_time}-{r.end_time}｜{TEAM_LABELS[r.team] === "其他" ? r.team_other_text : TEAM_LABELS[r.team]}｜{r.headcount}
                        人
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {capacityResult.exceeded && (
                <>
                  <p className="mt-2 font-semibold">以下時間區段實際超過容量上限，無法確認新增，請調整時間或人數：</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {capacityResult.violatingSegments.map((seg, i) => (
                      <li key={i}>
                        {seg.start}-{seg.end}｜該時段共 {seg.totalHeadcount} 人（超過容量 {capacityResult.capacity} 人）
                        {seg.contributing.length > 0 && <>，含既有預約：{seg.contributing.map((r) => r.reservation_no).join("、")}</>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {!capacityResult.isCapacityLimited &&
            draft.service === "therapy" &&
            draft.therapy?.therapy_branch === "doctor" &&
            capacityResult.overlapping.length > 0 && (
              <div className="rounded-lg p-3 text-sm bg-blue-50 border border-blue-200 text-blue-700">
                <p className="font-medium">提醒：同一時段已有其他醫師治療預約（不會擋下，僅供參考）</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {capacityResult.overlapping.map((r) => (
                    <li key={r.id}>
                      {r.reservation_no}｜{r.start_time}-{r.end_time}｜{r.team === "other" ? r.team_other_text : TEAM_LABELS[r.team]}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <div className="flex gap-3">
            <button onClick={() => setStep("form")} className="border rounded-lg px-4 py-2 text-sm">
              返回修改
            </button>
            <button
              onClick={confirmSave}
              disabled={capacityResult.exceeded}
              className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isEditing ? "確認儲存" : "確認新增"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function validateDraft(draft: ReservationDraft): string[] {
  const errors: string[] = [];
  if (!isDateInEventRange(draft.reservation_date)) errors.push(`預約日期須介於 ${EVENT_START_DATE} ～ ${EVENT_END_DATE} 之間`);
  if (draft.team === "other" && !draft.team_other_text.trim()) errors.push("選擇「其他」代表隊時，請填寫代表隊或單位名稱");
  if (!Number.isInteger(draft.headcount) || draft.headcount <= 0) errors.push("預約人數須為正整數");
  if (!draft.start_time) errors.push("請填寫開始時間");

  if (draft.service === "meal" && draft.meal) {
    const m = draft.meal;
    if (!Number.isInteger(m.meal_count) || m.meal_count <= 0) errors.push("餐食份數須為正整數");
    if (!m.serve_location.trim()) errors.push("請填寫餐食地點");
    if (!Number.isInteger(m.vegetarian_count) || m.vegetarian_count < 0) errors.push("素食份數須為 0 或正整數");
    else if (m.vegetarian_count > m.meal_count) errors.push("素食份數不得大於餐食總份數");
  }

  if (draft.service === "transport" && draft.transport) {
    const t = draft.transport;
    if (t.outbound_pickup === "other" && !t.outbound_pickup_other.trim()) errors.push("去程上車地點選「其他」時請填寫說明");
    if (t.outbound_dropoff === "other" && !t.outbound_dropoff_other.trim()) errors.push("去程下車地點選「其他」時請填寫說明");
    if (!Number.isInteger(t.passenger_count) || t.passenger_count <= 0) errors.push("乘車人數須為正整數");
    if (!Number.isInteger(t.wheelchair_count) || t.wheelchair_count < 0) errors.push("輪椅使用人數須為 0 或正整數");
    if (t.needs_accessible_vehicle && t.wheelchair_count <= 0) errors.push("需要福祉車時請填寫輪椅使用人數");
    if (Number.isInteger(t.wheelchair_count) && Number.isInteger(t.passenger_count) && t.wheelchair_count > t.passenger_count) {
      errors.push("輪椅使用人數不得大於去程乘車人數");
    }
    if (t.transport_type === "round_trip") {
      if (!t.return_time) errors.push("來回接駁請填寫回程上車時間");
      if (!t.return_pickup) errors.push("來回接駁請選擇回程上車地點");
      if (t.return_pickup === "other" && !t.return_pickup_other.trim()) errors.push("回程上車地點選「其他」時請填寫說明");
      if (!t.return_dropoff) errors.push("來回接駁請選擇回程下車地點");
      if (t.return_dropoff === "other" && !t.return_dropoff_other.trim()) errors.push("回程下車地點選「其他」時請填寫說明");
      if (!Number.isInteger(t.return_count) || t.return_count <= 0) errors.push("來回接駁請填寫正確的回程人數（正整數）");
    }
  }

  if ((draft.service === "therapy" || draft.service === "fitness" || draft.service === "sports_science") && !draft.end_time) {
    errors.push("請填寫結束時間");
  }
  if (draft.end_time && draft.start_time && draft.end_time <= draft.start_time) {
    errors.push("結束時間須晚於開始時間");
  }

  return errors;
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function MealFieldsBlock({
  draft,
  patch,
  mealMismatch,
}: {
  draft: ReservationDraft;
  patch: (p: Partial<ReservationDraft>) => void;
  mealMismatch: boolean;
}) {
  const meal = draft.meal!;
  function patchMeal(p: Partial<typeof meal>) {
    patch({ meal: { ...meal, ...p } });
  }
  return (
    <div className="border-t pt-4 space-y-4">
      <h4 className="text-sm font-semibold text-brand-700">餐食預約欄位</h4>
      <FieldGroup label="餐別" required>
        <div className="flex gap-2">
          {(["lunch", "dinner"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => patchMeal({ meal_type: v })}
              className={`px-3 py-1.5 rounded-lg text-sm border ${meal.meal_type === v ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600"}`}
            >
              {MEAL_TYPE_LABELS[v]}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="用餐／送餐時間" required>
        <input type="time" value={draft.start_time} onChange={(e) => patch({ start_time: e.target.value })} className="border rounded-lg px-3 py-2" />
      </FieldGroup>
      <FieldGroup label="餐食份數" required>
        <input type="number" min={1} step={1} value={meal.meal_count} onChange={(e) => patchMeal({ meal_count: Math.trunc(Number(e.target.value)) || 0 })} className="border rounded-lg px-3 py-2 w-32" />
        {mealMismatch && <p className="text-xs text-yellow-700 mt-1">份數與預約人數不同，仍可繼續。</p>}
      </FieldGroup>
      <FieldGroup label="供應方式" required>
        <select value={meal.serve_method} onChange={(e) => patchMeal({ serve_method: e.target.value as typeof meal.serve_method })} className="border rounded-lg px-3 py-2">
          {(Object.keys(MEAL_SERVE_METHOD_LABELS) as (keyof typeof MEAL_SERVE_METHOD_LABELS)[]).map((k) => (
            <option key={k} value={k}>
              {MEAL_SERVE_METHOD_LABELS[k]}
            </option>
          ))}
        </select>
      </FieldGroup>
      <FieldGroup label="地點" required>
        <input value={meal.serve_location} onChange={(e) => patchMeal({ serve_location: e.target.value })} className="border rounded-lg px-3 py-2 w-full max-w-xs" placeholder="例如：中繼站餐廳、比賽場館入口" />
      </FieldGroup>
      <FieldGroup label="餐食內容或特殊需求">
        <input value={meal.meal_content} onChange={(e) => patchMeal({ meal_content: e.target.value })} className="border rounded-lg px-3 py-2 w-full" />
      </FieldGroup>
      <FieldGroup label="素食份數">
        <input type="number" min={0} step={1} value={meal.vegetarian_count} onChange={(e) => patchMeal({ vegetarian_count: Math.trunc(Number(e.target.value)) || 0 })} className="border rounded-lg px-3 py-2 w-32" />
      </FieldGroup>
    </div>
  );
}

function LocationSelect({
  label,
  required,
  value,
  otherValue,
  onChange,
  onOtherChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  otherValue: string;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
}) {
  return (
    <FieldGroup label={label} required={required}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border rounded-lg px-3 py-2">
        {TRANSPORT_LOCATION_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {TRANSPORT_LOCATION_LABELS[c]}
          </option>
        ))}
      </select>
      {value === "other" && (
        <input value={otherValue} onChange={(e) => onOtherChange(e.target.value)} placeholder="請輸入地點" className="border rounded-lg px-3 py-2 ml-2 w-48" />
      )}
    </FieldGroup>
  );
}

function TransportFieldsBlock({ draft, patch }: { draft: ReservationDraft; patch: (p: Partial<ReservationDraft>) => void }) {
  const t = draft.transport!;
  function patchT(p: Partial<typeof t>) {
    patch({ transport: { ...t, ...p } });
  }
  return (
    <div className="border-t pt-4 space-y-4">
      <h4 className="text-sm font-semibold text-brand-700">交通接駁預約欄位</h4>
      <p className="text-xs text-gray-400">
        目前可用車輛：一般車輛 4 台（每台最多 9 人）、福祉車 1 台。本系統只負責蒐集接駁需求，不會自動排車或指派車輛。
      </p>
      <FieldGroup label="接駁類型" required>
        <div className="flex gap-2">
          {(["one_way", "round_trip"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => patchT({ transport_type: v })}
              className={`px-3 py-1.5 rounded-lg text-sm border ${t.transport_type === v ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600"}`}
            >
              {v === "one_way" ? "單程" : "來回"}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="去程上車時間" required>
        <input type="time" value={draft.start_time} onChange={(e) => patch({ start_time: e.target.value })} className="border rounded-lg px-3 py-2" />
      </FieldGroup>
      <LocationSelect
        label="去程上車地點"
        required
        value={t.outbound_pickup}
        otherValue={t.outbound_pickup_other}
        onChange={(v) => patchT({ outbound_pickup: v as typeof t.outbound_pickup })}
        onOtherChange={(v) => patchT({ outbound_pickup_other: v })}
      />
      <LocationSelect
        label="去程下車地點"
        required
        value={t.outbound_dropoff}
        otherValue={t.outbound_dropoff_other}
        onChange={(v) => patchT({ outbound_dropoff: v as typeof t.outbound_dropoff })}
        onOtherChange={(v) => patchT({ outbound_dropoff_other: v })}
      />
      <FieldGroup label="乘車人數（去程）" required>
        <input
          type="number"
          min={1}
          step={1}
          value={t.passenger_count}
          onChange={(e) => {
            const n = Math.trunc(Number(e.target.value)) || 0;
            // 交通接駁以去程乘車人數作為這筆預約的主要人數，兩者永遠保持一致，不再另外顯示共用的「預約人數」欄位
            patch({ headcount: n, transport: { ...t, passenger_count: n } });
          }}
          className="border rounded-lg px-3 py-2 w-32"
        />
        <p className="text-xs text-gray-400 mt-1">交通接駁以「去程乘車人數」作為這筆預約的主要人數，來回時回程人數可以另外填寫。</p>
      </FieldGroup>
      <FieldGroup label="是否需要福祉車">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={t.needs_accessible_vehicle} onChange={(e) => patchT({ needs_accessible_vehicle: e.target.checked })} />
          需要福祉車
        </label>
      </FieldGroup>
      {t.needs_accessible_vehicle && (
        <FieldGroup label="輪椅使用人數" required>
          <input type="number" min={0} step={1} value={t.wheelchair_count} onChange={(e) => patchT({ wheelchair_count: Math.trunc(Number(e.target.value)) || 0 })} className="border rounded-lg px-3 py-2 w-32" />
        </FieldGroup>
      )}
      <FieldGroup label="乘車人員或隊伍說明">
        <input value={t.passenger_note} onChange={(e) => patchT({ passenger_note: e.target.value })} className="border rounded-lg px-3 py-2 w-full" />
      </FieldGroup>

      {t.transport_type === "round_trip" && (
        <div className="border-t pt-3 space-y-4">
          <h5 className="text-sm font-semibold text-brand-700">回程資訊</h5>
          <FieldGroup label="回程上車時間" required>
            <input type="time" value={t.return_time} onChange={(e) => patchT({ return_time: e.target.value })} className="border rounded-lg px-3 py-2" />
          </FieldGroup>
          <LocationSelect
            label="回程上車地點"
            required
            value={t.return_pickup || ""}
            otherValue={t.return_pickup_other}
            onChange={(v) => patchT({ return_pickup: v as typeof t.outbound_pickup })}
            onOtherChange={(v) => patchT({ return_pickup_other: v })}
          />
          <LocationSelect
            label="回程下車地點"
            required
            value={t.return_dropoff || ""}
            otherValue={t.return_dropoff_other}
            onChange={(v) => patchT({ return_dropoff: v as typeof t.outbound_dropoff })}
            onOtherChange={(v) => patchT({ return_dropoff_other: v })}
          />
          <FieldGroup label="回程人數" required>
            <input type="number" min={1} step={1} value={t.return_count} onChange={(e) => patchT({ return_count: Math.trunc(Number(e.target.value)) || 0 })} className="border rounded-lg px-3 py-2 w-32" />
          </FieldGroup>
        </div>
      )}
    </div>
  );
}

function TherapyFieldsBlock({ draft, patch }: { draft: ReservationDraft; patch: (p: Partial<ReservationDraft>) => void }) {
  const th = draft.therapy!;
  return (
    <div className="border-t pt-4 space-y-4">
      <h4 className="text-sm font-semibold text-brand-700">防護治療預約欄位</h4>
      <FieldGroup label="分支項目" required>
        <select value={th.therapy_branch} onChange={(e) => patch({ therapy: { ...th, therapy_branch: e.target.value as typeof th.therapy_branch } })} className="border rounded-lg px-3 py-2">
          {THERAPY_BRANCH_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {THERAPY_BRANCH_LABELS[b]}
              {b !== "doctor" ? `（同一時段至多 ${b === "protective_treatment" ? 3 : 2} 人）` : ""}
            </option>
          ))}
        </select>
      </FieldGroup>
      <div className="flex gap-4">
        <FieldGroup label="開始時間" required>
          <input type="time" value={draft.start_time} onChange={(e) => patch({ start_time: e.target.value })} className="border rounded-lg px-3 py-2" />
        </FieldGroup>
        <FieldGroup label="結束時間" required>
          <input type="time" value={draft.end_time} onChange={(e) => patch({ end_time: e.target.value })} className="border rounded-lg px-3 py-2" />
        </FieldGroup>
      </div>
      <FieldGroup label="需求說明">
        <textarea value={th.requirement_note} onChange={(e) => patch({ therapy: { ...th, requirement_note: e.target.value } })} className="border rounded-lg px-3 py-2 w-full" rows={2} />
      </FieldGroup>
    </div>
  );
}

function FitnessFieldsBlock({ draft, patch }: { draft: ReservationDraft; patch: (p: Partial<ReservationDraft>) => void }) {
  const f = draft.fitness!;
  return (
    <div className="border-t pt-4 space-y-4">
      <h4 className="text-sm font-semibold text-brand-700">體能訓練預約欄位</h4>
      <FieldGroup label="分支項目" required>
        <select value={f.fitness_branch} onChange={(e) => patch({ fitness: { ...f, fitness_branch: e.target.value as typeof f.fitness_branch } })} className="border rounded-lg px-3 py-2">
          {FITNESS_BRANCH_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {FITNESS_BRANCH_LABELS[b]}（同一時段至多 10 人）
            </option>
          ))}
        </select>
      </FieldGroup>
      <div className="flex gap-4">
        <FieldGroup label="開始時間" required>
          <input type="time" value={draft.start_time} onChange={(e) => patch({ start_time: e.target.value })} className="border rounded-lg px-3 py-2" />
        </FieldGroup>
        <FieldGroup label="結束時間" required>
          <input type="time" value={draft.end_time} onChange={(e) => patch({ end_time: e.target.value })} className="border rounded-lg px-3 py-2" />
        </FieldGroup>
      </div>
      <FieldGroup label="訓練需求">
        <textarea value={f.training_requirement} onChange={(e) => patch({ fitness: { ...f, training_requirement: e.target.value } })} className="border rounded-lg px-3 py-2 w-full" rows={2} />
      </FieldGroup>
    </div>
  );
}

function SportsScienceFieldsBlock({ draft, patch }: { draft: ReservationDraft; patch: (p: Partial<ReservationDraft>) => void }) {
  const s = draft.sportsScience!;
  const capLabel: Record<string, number> = { physio_test: 5, air_massage: 12, compression_chamber: 5, individual_consult: 2, nutrition_consult: 2 };
  return (
    <div className="border-t pt-4 space-y-4">
      <h4 className="text-sm font-semibold text-brand-700">運科支援預約欄位</h4>
      <FieldGroup label="分支項目" required>
        <select
          value={s.sports_science_branch}
          onChange={(e) => patch({ sportsScience: { ...s, sports_science_branch: e.target.value as typeof s.sports_science_branch } })}
          className="border rounded-lg px-3 py-2"
        >
          {SPORTS_SCIENCE_BRANCH_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {SPORTS_SCIENCE_BRANCH_LABELS[b]}（同一時段至多 {capLabel[b]} 人）
            </option>
          ))}
        </select>
      </FieldGroup>
      <div className="flex gap-4">
        <FieldGroup label="開始時間" required>
          <input type="time" value={draft.start_time} onChange={(e) => patch({ start_time: e.target.value })} className="border rounded-lg px-3 py-2" />
        </FieldGroup>
        <FieldGroup label="結束時間" required>
          <input type="time" value={draft.end_time} onChange={(e) => patch({ end_time: e.target.value })} className="border rounded-lg px-3 py-2" />
        </FieldGroup>
      </div>
      <FieldGroup label="需求說明">
        <textarea value={s.requirement_note} onChange={(e) => patch({ sportsScience: { ...s, requirement_note: e.target.value } })} className="border rounded-lg px-3 py-2 w-full" rows={2} />
      </FieldGroup>
    </div>
  );
}
