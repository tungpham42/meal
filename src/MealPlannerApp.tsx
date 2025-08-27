import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  InputGroup,
  Badge,
  Modal,
  Offcanvas,
  Spinner,
  Dropdown,
  ButtonGroup,
  Image,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faCircleInfo,
  faPlus,
  faRandom,
  faTrash,
  faCalendarDays,
  faListCheck,
  faUtensils,
  faCartShopping,
  faRotateRight,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

// Import the custom CSS
import "./index.css";

// ---------- Types ----------
export type Meal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | undefined;
  strArea: string | undefined;
  strInstructions: string | undefined;
  strMealThumb: string | undefined;
  strYoutube?: string | undefined;
  [key: string]: any; // keep flexible for ingredient fields
};

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type Plan = Record<DayKey, Meal | null>;

// ---------- API helpers ----------
const API_BASE = "https://www.themealdb.com/api/json/v2/9973533"; // free key from user prompt

async function api<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function searchMeals(q: string): Promise<Meal[]> {
  const data = await api<{ meals: Meal[] | null }>(
    `/search.php?s=${encodeURIComponent(q)}`
  );
  return data.meals ?? [];
}

async function getMealById(id: string): Promise<Meal | null> {
  const data = await api<{ meals: Meal[] | null }>(`/lookup.php?i=${id}`);
  return data.meals?.[0] ?? null;
}

async function randomMeal(): Promise<Meal | null> {
  const data = await api<{ meals: Meal[] | null }>(`/random.php`);
  return data.meals?.[0] ?? null;
}

async function listCategories(): Promise<string[]> {
  const data = await api<{ categories: { strCategory: string }[] }>(
    `/categories.php`
  );
  return data.categories.map((c) => c.strCategory);
}

async function listAreas(): Promise<string[]> {
  const data = await api<{ meals: { strArea: string }[] | null }>(
    `/list.php?a=list`
  );
  return (data.meals ?? []).map((a) => a.strArea);
}

async function filterByCategory(category: string): Promise<Meal[]> {
  const data = await api<{ meals: Meal[] | null }>(
    `/filter.php?c=${encodeURIComponent(category)}`
  );
  return data.meals ?? [];
}

async function filterByArea(area: string): Promise<Meal[]> {
  const data = await api<{ meals: Meal[] | null }>(
    `/filter.php?a=${encodeURIComponent(area)}`
  );
  return data.meals ?? [];
}

// ---------- Utilities ----------
function extractIngredients(meal: Meal): { name: string; measure: string }[] {
  const result: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal as any)[`strIngredient${i}`];
    const measure = (meal as any)[`strMeasure${i}`];
    if (name && name.trim() !== "") {
      result.push({ name: name.trim(), measure: (measure || "").trim() });
    }
  }
  return result;
}

const DAY_KEYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function blankPlan(): Plan {
  return DAY_KEYS.reduce((acc, d) => ({ ...acc, [d]: null }), {} as Plan);
}

// ---------- Local storage ----------
const LS_FAVS = "mealdb:favorites";
const LS_PLAN = "mealdb:plan";

function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}

// ---------- UI Components ----------
function MealCard({
  meal,
  onAdd,
  onDetails,
  onToggleFav,
  isFav,
}: {
  meal: Meal;
  onAdd: (meal: Meal) => void;
  onDetails: (meal: Meal) => void;
  onToggleFav: (meal: Meal) => void;
  isFav: boolean;
}) {
  return (
    <Card className="h-100">
      {meal.strMealThumb && (
        <Card.Img
          variant="top"
          src={meal.strMealThumb}
          alt={meal.strMeal}
          className="card-img-top"
        />
      )}
      <Card.Body>
        <Card.Title className="d-flex justify-content-between align-items-start gap-2">
          <span className="fw-semibold" style={{ lineHeight: 1.2 }}>
            {meal.strMeal}
          </span>
          <Button
            variant={isFav ? "danger" : "outline-secondary"}
            size="sm"
            onClick={() => onToggleFav(meal)}
            aria-label="Toggle favorite"
          >
            <FontAwesomeIcon icon={faHeart} />
          </Button>
        </Card.Title>
        <div className="mb-2 d-flex gap-2 flex-wrap">
          {meal.strCategory && (
            <Badge>
              <FontAwesomeIcon icon={faUtensils} className="me-1" />
              {meal.strCategory}
            </Badge>
          )}
          {meal.strArea && <Badge>{meal.strArea}</Badge>}
        </div>
        <div className="d-flex gap-2">
          <Button size="sm" variant="primary" onClick={() => onDetails(meal)}>
            <FontAwesomeIcon icon={faCircleInfo} className="me-2" />
            Details
          </Button>
          <Dropdown as={ButtonGroup} size="sm">
            <Button variant="success" onClick={() => onAdd(meal)}>
              <FontAwesomeIcon icon={faPlus} className="me-2" />
              Add to Plan
            </Button>
            <Dropdown.Toggle split variant="success" id="add-split" />
            <Dropdown.Menu>
              {DAY_KEYS.map((d) => (
                <Dropdown.Item
                  key={d}
                  onClick={() => onAdd({ ...meal, __forceDay: d } as any)}
                >
                  {d}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Card.Body>
    </Card>
  );
}

function MealDetailsModal({
  mealId,
  show,
  onHide,
}: {
  mealId: string | null;
  show: boolean;
  onHide: () => void;
}) {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!mealId) return;
      setLoading(true);
      try {
        const m = await getMealById(mealId);
        if (active) setMeal(m);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [mealId]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="culinary-header">
          {meal?.strMeal ?? "Meal Details"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && (
          <div className="d-flex justify-content-center py-5">
            <Spinner animation="border" />
          </div>
        )}
        {!loading && meal && (
          <>
            <Row className="g-3">
              <Col md={5}>
                {meal.strMealThumb && (
                  <img
                    src={meal.strMealThumb}
                    alt={meal.strMeal}
                    className="img-fluid rounded-3 shadow-sm"
                  />
                )}
                <div className="mt-3 d-flex gap-2 flex-wrap">
                  {meal.strCategory && <Badge>{meal.strCategory}</Badge>}
                  {meal.strArea && <Badge>{meal.strArea}</Badge>}
                </div>
              </Col>
              <Col md={7}>
                <h6 className="mb-2 culinary-header">Ingredients</h6>
                <ul className="small">
                  {extractIngredients(meal).map((ing, i) => (
                    <li key={i}>
                      {ing.name}{" "}
                      {ing.measure && (
                        <em className="text-muted">— {ing.measure}</em>
                      )}
                    </li>
                  ))}
                </ul>
                {meal.strInstructions && (
                  <>
                    <h6 className="mt-3 culinary-header">Instructions</h6>
                    <p className="small" style={{ whiteSpace: "pre-wrap" }}>
                      {meal.strInstructions}
                    </p>
                  </>
                )}
              </Col>
            </Row>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function Planner({
  plan,
  onRemove,
  onSwap,
}: {
  plan: Plan;
  onRemove: (day: DayKey) => void;
  onSwap: (a: DayKey, b: DayKey) => void;
}) {
  return (
    <Card>
      <Card.Header className="bg-white d-flex justify-content-between align-items-center">
        <div className="fw-semibold culinary-header">
          <FontAwesomeIcon icon={faCalendarDays} className="me-2" />
          Weekly Plan
        </div>
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          {DAY_KEYS.map((d) => (
            <Col md={6} lg={4} key={d}>
              <div className="p-3 day-card">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong className="culinary-header">{d}</strong>
                  <div className="d-flex gap-2">
                    <Dropdown>
                      <Dropdown.Toggle size="sm" variant="outline-secondary">
                        Swap
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {DAY_KEYS.filter((x) => x !== d).map((x) => (
                          <Dropdown.Item key={x} onClick={() => onSwap(d, x)}>
                            {x}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => onRemove(d)}
                      aria-label={`Remove ${d}`}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </div>
                </div>
                {plan[d] ? (
                  <div className="d-flex gap-3">
                    {plan[d]?.strMealThumb && (
                      <Image
                        src={plan[d]!.strMealThumb}
                        alt={plan[d]!.strMeal}
                        width={72}
                        height={72}
                        className="rounded object-fit-cover"
                      />
                    )}
                    <div>
                      <div className="fw-semibold">{plan[d]!.strMeal}</div>
                      <div className="small text-muted">
                        {plan[d]!.strCategory}{" "}
                        {plan[d]!.strArea ? `• ${plan[d]!.strArea}` : ""}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted small">
                    No meal yet — add from Search, Favorites, or Random.
                  </div>
                )}
              </div>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
}

function ShoppingListOffcanvas({
  show,
  onHide,
  plan,
}: {
  show: boolean;
  onHide: () => void;
  plan: Plan;
}) {
  const ingredients = useMemo(() => {
    const map = new Map<string, { measure: string; count: number }>();
    for (const day of DAY_KEYS) {
      const meal = plan[day];
      if (!meal) continue;
      for (const ing of extractIngredients(meal)) {
        const key = ing.name.toLowerCase();
        const current = map.get(key) ?? { measure: ing.measure, count: 0 };
        const qty = parseFloat(ing.measure || "");
        if (!isNaN(qty) && current.measure === ing.measure) {
          // Sum quantities if measures are compatible (same unit)
          map.set(key, { measure: ing.measure, count: current.count + qty });
        } else {
          // Count occurrences if measures are non-numeric or incompatible
          map.set(key, { measure: ing.measure, count: current.count + 1 });
        }
      }
    }
    return Array.from(map.entries()).map(([name, { measure, count }]) => ({
      name,
      measure:
        count > 1 && !isNaN(parseFloat(measure))
          ? `${count} ${measure.replace(/^\d+\s*/, "")}`
          : measure,
      count,
    }));
  }, [plan]);

  return (
    <Offcanvas show={show} onHide={onHide} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title className="culinary-header">
          <FontAwesomeIcon icon={faCartShopping} className="me-2" />
          Shopping List
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {ingredients.length === 0 ? (
          <p className="text-muted">
            Your plan is empty. Add meals to generate a shopping list.
          </p>
        ) : (
          <ul className="list-group">
            {ingredients.map((it) => (
              <li
                key={it.name}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <span className="text-capitalize">{it.name}</span>
                <Badge>{it.measure || it.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

// ---------- Main App ----------
export default function MealPlannerApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [filter, setFilter] = useState<{ category?: string; area?: string }>(
    {}
  );

  const [favorites, setFavorites] = useLocalStorage<Meal[]>(LS_FAVS, []);
  const [plan, setPlan] = useLocalStorage<Plan>(LS_PLAN, blankPlan());

  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showShopping, setShowShopping] = useState(false);

  useEffect(() => {
    (async () => {
      const [cats, ars] = await Promise.all([listCategories(), listAreas()]);
      setCategories(cats);
      setAreas(ars);
    })();
  }, []);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      let items: Meal[] = [];

      // Fetch meals from search query
      if (query.trim() !== "") {
        items = await searchMeals(query.trim());
      }

      // Fetch meals from category filter and enrich with full details
      if (filter.category) {
        const catItems = await filterByCategory(filter.category);
        const fullCatItems = await Promise.all(
          catItems.map(async (meal) => {
            const fullMeal = await getMealById(meal.idMeal);
            return fullMeal ?? meal; // Fallback to minimal meal if lookup fails
          })
        );
        // Merge with existing items, preferring full meal data
        const byId = new Map(items.map((m) => [m.idMeal, m] as const));
        for (const m of fullCatItems) {
          byId.set(m.idMeal, m);
        }
        items = Array.from(byId.values());
      }

      // Fetch meals from area filter and enrich with full details
      if (filter.area) {
        const areaItems = await filterByArea(filter.area);
        const fullAreaItems = await Promise.all(
          areaItems.map(async (meal) => {
            const fullMeal = await getMealById(meal.idMeal);
            return fullMeal ?? meal; // Fallback to minimal meal if lookup fails
          })
        );
        // Merge with existing items, preferring full meal data
        const byId = new Map(items.map((m) => [m.idMeal, m] as const));
        for (const m of fullAreaItems) {
          byId.set(m.idMeal, m);
        }
        items = Array.from(byId.values());
      }

      setResults(items);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRandom() {
    setLoading(true);
    try {
      const m = await randomMeal();
      setResults(m ? [m] : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function toggleFavorite(meal: Meal) {
    setFavorites((prev) =>
      prev.some((m) => m.idMeal === meal.idMeal)
        ? prev.filter((m) => m.idMeal !== meal.idMeal)
        : [...prev, meal]
    );
  }

  function addToPlan(meal: Meal & { __forceDay?: DayKey }) {
    const day = meal.__forceDay || firstEmptyDay(plan) || "Mon";
    setPlan({ ...plan, [day]: meal });
  }

  function removeFromPlan(day: DayKey) {
    setPlan({ ...plan, [day]: null });
  }

  function swapDays(a: DayKey, b: DayKey) {
    const clone = { ...plan };
    const tmp = clone[a];
    clone[a] = clone[b];
    clone[b] = tmp;
    setPlan(clone);
  }

  function firstEmptyDay(p: Plan): DayKey | null {
    for (const d of DAY_KEYS) if (!p[d]) return d;
    return null;
  }

  return (
    <Container className="py-5 my-5">
      <Row className="mb-4 align-items-center g-2">
        <Col xs="auto">
          <h3 className="culinary-header">
            <FontAwesomeIcon icon={faListCheck} className="me-2" />
            Meal Planner
          </h3>
        </Col>
        <Col className="text-end">
          <Button
            variant="outline-danger"
            className="me-2"
            onClick={() => setShowShopping(true)}
          >
            <FontAwesomeIcon icon={faCartShopping} className="me-2" />
            Shopping List
          </Button>
          <Button
            variant="outline-secondary"
            onClick={() => {
              setPlan(blankPlan());
            }}
          >
            <FontAwesomeIcon icon={faRotateRight} className="me-2" />
            Reset Plan
          </Button>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row className="g-2 align-items-end">
              <Col md={5}>
                <Form.Label className="small text-muted">
                  Search by name
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </InputGroup.Text>
                  <Form.Control
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Arrabiata, Chicken, Soup"
                  />
                </InputGroup>
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted">Category</Form.Label>
                <Form.Select
                  value={filter.category ?? ""}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      category: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">Any</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted">Area</Form.Label>
                <Form.Select
                  value={filter.area ?? ""}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      area: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">Any</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={1} className="d-grid">
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Spinner size="sm" animation="border" /> : "Go"}
                </Button>
              </Col>
            </Row>
          </Form>
          <div className="mt-3 d-flex gap-2">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => {
                setQuery("");
                setFilter({});
                setResults([]);
              }}
            >
              Clear
            </Button>
            <Button size="sm" variant="warning" onClick={handleRandom}>
              <FontAwesomeIcon icon={faRandom} className="me-2" />
              Random meal
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col lg={8}>
          <Planner plan={plan} onRemove={removeFromPlan} onSwap={swapDays} />
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header className="bg-white">
              <FontAwesomeIcon icon={faHeart} className="me-2" />
              <span className="culinary-header">Favorites</span>
            </Card.Header>
            <Card.Body>
              {favorites.length === 0 && (
                <div className="text-muted small">
                  No favorites yet. Click the heart on any meal.
                </div>
              )}
              <div className="d-grid gap-2">
                {favorites.map((meal) => (
                  <Button
                    key={meal.idMeal}
                    variant="outline-secondary"
                    size="sm"
                    className="text-start"
                    onClick={() => setResults([meal])}
                  >
                    {meal.strMeal}
                  </Button>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <h5 className="mt-4 mb-2 culinary-header">Results</h5>
      {loading && (
        <div className="d-flex justify-content-center py-4">
          <Spinner animation="border" />
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="text-muted">
          Try searching a meal name, choosing a category/area, or roll a random
          meal.
        </div>
      )}
      {!loading && results.length > 0 && (
        <Row className="g-3">
          {results.map((meal) => (
            <Col md={6} lg={4} key={meal.idMeal}>
              <MealCard
                meal={meal}
                onAdd={(m) => addToPlan(m)}
                onDetails={(m) => setDetailsId(m.idMeal)}
                onToggleFav={toggleFavorite}
                isFav={favorites.some((m) => m.idMeal === meal.idMeal)}
              />
            </Col>
          ))}
        </Row>
      )}

      <MealDetailsModal
        mealId={detailsId}
        show={!!detailsId}
        onHide={() => setDetailsId(null)}
      />
      <ShoppingListOffcanvas
        show={showShopping}
        onHide={() => setShowShopping(false)}
        plan={plan}
      />
    </Container>
  );
}
